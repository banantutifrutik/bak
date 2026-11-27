import { useEffect, useRef, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:8000";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg"];

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);   // локальный предпросмотр
  const [progress, setProgress] = useState(0);          // 0..100
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);           // ответ сервера
  const [error, setError] = useState(null);             // сообщение об ошибке
  const inputRef = useRef(null);

  // Освобождаем ObjectURL при смене/размонтировании
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ---------- Выбор файла + локальный предпросмотр ----------
  const handleFileChange = (e) => {
    setError(null);
    setResult(null);
    setProgress(0);

    const f = e.target.files?.[0];
    if (!f) return;

    // Клиентская валидация — для быстрой обратной связи
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError("Разрешены только PNG и JPEG.");
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (f.size > MAX_SIZE) {
      setError(`Файл слишком большой: ${(f.size / 1024 / 1024).toFixed(2)} МБ. Максимум — 5 МБ.`);
      setFile(null);
      setPreviewUrl(null);
      return;
    }

    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));   // локальный предпросмотр до отправки
  };

  // ---------- Отправка на сервер ----------
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data } = await axios.post(`${API_URL}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (evt.total) {
            const pct = Math.round((evt.loaded * 100) / evt.total);
            setProgress(pct);
            console.log(`Прогресс загрузки: ${pct}%`);
          }
        },
      });

      setResult(data);
    } catch (err) {
      // Обработка ошибки сервера — без падения приложения
      const msg =
        err.response?.data?.detail ||
        err.message ||
        "Не удалось загрузить файл.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="container">
      <h1>Загрузка изображения</h1>

      {/* ---------- Выбор файла ---------- */}
      <div className="card">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <p className="hint">PNG или JPEG, до 5 МБ.</p>

        {/* ---------- Локальный предпросмотр ---------- */}
        {previewUrl && (
          <div className="preview">
            <p>Предпросмотр (локальный):</p>
            <img src={previewUrl} alt="preview" />
            <p className="meta">
              {file.name} — {(file.size / 1024).toFixed(1)} КБ
            </p>
          </div>
        )}

        {/* ---------- Кнопки ---------- */}
        <div className="actions">
          <button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Загрузка..." : "Отправить на сервер"}
          </button>
          {(file || result || error) && (
            <button className="secondary" onClick={handleReset} disabled={uploading}>
              Сбросить
            </button>
          )}
        </div>

        {/* ---------- Прогресс ---------- */}
        {uploading && (
          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
            <span className="progress-text">{progress}%</span>
          </div>
        )}
      </div>

      {/* ---------- Ошибка ---------- */}
      {error && (
        <div className="card error">
          <strong>Ошибка:</strong> {error}
        </div>
      )}

      {/* ---------- Результат от сервера ---------- */}
      {result && (
        <div className="card success">
          <h2>Готово!</h2>
          <div className="result-grid">
            <div>
              <p>Оригинал ({result.width}×{result.height}):</p>
              <img src={result.original_url} alt="original" />
              <p className="meta">
                <a href={result.original_url} target="_blank" rel="noreferrer">
                  {result.original_url}
                </a>
              </p>
            </div>
            <div>
              <p>
                Миниатюра ({result.thumb_width}×{result.thumb_height}):
              </p>
              <img src={result.thumbnail_url} alt="thumbnail" />
              <p className="meta">
                <a href={result.thumbnail_url} target="_blank" rel="noreferrer">
                  {result.thumbnail_url}
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}