import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
type Item = {
  id: string;
  title: string;
  text: string;
  type: string;
  url?: string;
  source: string;
  tags: string[];
  collectionId?: string;
  collection?: { name: string };
  mediaUrl?: string;
  createdAt: string;
};
type Collection = { id: string; name: string; _count: { items: number } };
const tg = (window as any).Telegram?.WebApp;
tg?.ready();
tg?.expand();
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(`/api/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(tg?.initData ? { Authorization: `tma ${tg.initData}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(
      typeof e.message === "string" ? e.message : "Не удалось выполнить запрос",
    );
  }
  return r.json();
}
function App() {
  const [items, setItems] = useState<Item[]>([]),
    [collections, setCollections] = useState<Collection[]>([]),
    [collection, setCollection] = useState(""),
    [type, setType] = useState(""),
    [query, setQuery] = useState(""),
    [tag, setTag] = useState(""),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [modal, setModal] = useState(false),
    [selected, setSelected] = useState<Item | null>(null),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [grid, setGrid] = useState(true);
  const [title, setTitle] = useState(""),
    [url, setUrl] = useState(""),
    [text, setText] = useState(""),
    [tags, setTags] = useState(""),
    [folder, setFolder] = useState(""),
    [file, setFile] = useState<File | null>(null);
  const params = () =>
    new URLSearchParams({
      ...(collection ? { collection } : {}),
      ...(type ? { type } : {}),
      ...(query ? { q: query } : {}),
      ...(tag ? { tag } : {}),
    });
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      Promise.all([api(`items?${params()}`), api("collections")])
        .then(([data, c]) => {
          if (active) {
            setItems(data.items);
            setCursor(data.nextCursor);
            setCollections(c);
            setError("");
          }
        })
        .catch((e) => active && setError(e.message))
        .finally(() => active && setLoading(false));
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [collection, type, query, tag, refresh]);
  function open(item?: Item) {
    setSelected(item || null);
    setTitle(item?.title || "");
    setUrl(item?.url || "");
    setText(item?.text || "");
    setTags(item?.tags.join(", ") || "");
    setFolder(item?.collectionId || "");
    setFile(null);
    setModal(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let mediaKey, mime;
      if (file) {
        const upload = await api("uploads", "POST", {
          mime: file.type,
          size: file.size,
        });
        const r = await fetch(upload.url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!r.ok) throw new Error("Ошибка загрузки файла");
        mediaKey = upload.key;
        mime = file.type;
      }
      const common = {
        title: title.trim() || file?.name || url || text.slice(0, 80),
        text,
        tags: [
          ...new Set(
            tags
              .split(",")
              .map((t) => t.trim().replace(/^#/, ""))
              .filter(Boolean),
          ),
        ],
        collectionId: folder || null,
      };
      await api(
        selected ? `items/${selected.id}` : "items",
        selected ? "PATCH" : "POST",
        selected
          ? common
          : {
              ...common,
              type: file
                ? file.type.startsWith("video/")
                  ? "video"
                  : "photo"
                : url
                  ? "link"
                  : "text",
              ...(url ? { url } : {}),
              mediaKey,
              mime,
            },
      );
      setModal(false);
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addCollection() {
    const name = prompt("Название коллекции");
    if (!name?.trim()) return;
    try {
      await api("collections", "POST", { name });
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove() {
    if (!selected || !confirm("Удалить сохранённое?")) return;
    setBusy(true);
    try {
      await api(`items/${selected.id}`, "DELETE");
      setModal(false);
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function more() {
    try {
      const p = params();
      p.set("cursor", cursor!);
      const data = await api(`items?${p}`);
      setItems((v) => [...v, ...data.items]);
      setCursor(data.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="app">
      <aside>
        <a className="brand" href="#">
          save<span>✳</span>
        </a>
        <div className="space">
          <span className="avatar">М</span>
          <div>
            <b>Моё пространство</b>
            <small>Всё, что хочется сохранить</small>
          </div>
        </div>
        <p className="eyebrow">БИБЛИОТЕКА</p>
        <button
          className={!collection ? "nav active" : "nav"}
          onClick={() => setCollection("")}
        >
          <span>▦</span>Все сохранённое
        </button>
        <button
          className={collection === "inbox" ? "nav active" : "nav"}
          onClick={() => setCollection("inbox")}
        >
          <span>⌑</span>Входящие
        </button>
        <div className="section-label">
          <p className="eyebrow">КОЛЛЕКЦИИ</p>
          <button aria-label="Создать коллекцию" onClick={addCollection}>
            +
          </button>
        </div>
        {collections.map((c) => (
          <button
            key={c.id}
            className={collection === c.id ? "nav active" : "nav"}
            onClick={() => setCollection(c.id)}
          >
            <span>▱</span>
            {c.name}
            <small>{c._count.items}</small>
          </button>
        ))}
        {!collections.length && (
          <p className="hint">Соберите идеи в свою первую коллекцию.</p>
        )}
        <div className="aside-bottom">
          <span>✳</span>
          <p>
            Хорошие находки
            <br />
            заслуживают своего места.
          </p>
        </div>
      </aside>
      <main>
        <header>
          <span className="breadcrumb">
            Моё пространство <span>/</span> Библиотека
          </span>
          <button className="primary" onClick={() => open()}>
            ＋ Добавить
          </button>
        </header>
        <section className="heading">
          <div>
            <p className="eyebrow">ВАША МАЛЕНЬКАЯ КОЛЛЕКЦИЯ МИРА</p>
            <h1>
              {collection === "inbox"
                ? "Входящие"
                : collections.find((c) => c.id === collection)?.name ||
                  "Всё сохранённое"}
              <span>✳</span>
            </h1>
            <p>Идеи, к которым хочется вернуться.</p>
          </div>
          <span className="counter">
            {items.length}
            {cursor ? "+" : ""} находок
          </span>
        </section>
        <div className="tools">
          <label className="search">
            <span>⌕</span>
            <input
              aria-label="Поиск"
              placeholder="Найти что-то своё…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            className="view-toggle"
            onClick={() => setGrid(!grid)}
            aria-label="Переключить вид"
          >
            {grid ? "☷" : "▦"}
          </button>
        </div>
        <div className="filters">
          {[
            ["", "Всё"],
            ["link", "↗ Ссылки"],
            ["photo", "▧ Фото"],
            ["video", "▷ Видео"],
            ["text", "≡ Заметки"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={type === value ? "chip chosen" : "chip"}
              onClick={() => setType(value)}
            >
              {label}
            </button>
          ))}
          {tag && (
            <button className="chip chosen" onClick={() => setTag("")}>
              #{tag} ×
            </button>
          )}
        </div>
        {error && (
          <div role="alert" className="error">
            {error}
            <button onClick={() => setRefresh((v) => v + 1)}>Повторить</button>
          </div>
        )}
        {loading ? (
          <div className="empty">Собираем ваши находки…</div>
        ) : error ? null : items.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">✳</div>
            <h2>
              {query || type || tag
                ? "Пока ничего не найдено"
                : "Здесь начинается ваша коллекция"}
            </h2>
            <p>
              {query || type || tag
                ? "Попробуйте другой запрос или фильтр."
                : "Сохраните ссылку, фотографию или мысль. Всё будет под рукой."}
            </p>
            <button className="primary" onClick={() => open()}>
              ＋ Сохранить находку
            </button>
          </div>
        ) : (
          <div className={grid ? "cards" : "cards list"}>
            {items.map((i) => (
              <article
                key={i.id}
                onClick={() => open(i)}
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" && e.target === e.currentTarget && open(i)
                }
              >
                <div className={`preview ${i.type}`}>
                  {i.mediaUrl ? (
                    i.type === "video" ? (
                      <video src={i.mediaUrl} preload="metadata" />
                    ) : (
                      <img src={i.mediaUrl} loading="lazy" alt={i.title} />
                    )
                  ) : (
                    <>
                      <span className="preview-symbol">
                        {i.type === "link" ? "↗" : "“"}
                      </span>
                      <p>
                        {i.type === "link"
                          ? i.source
                          : i.text.slice(0, 170) || i.title}
                      </p>
                    </>
                  )}
                  <span className="type-badge">
                    {
                      (
                        {
                          link: "Ссылка",
                          photo: "Фото",
                          video: "Видео",
                          text: "Заметка",
                        } as Record<string, string>
                      )[i.type]
                    }
                  </span>
                </div>
                <div className="card-body">
                  <small className="source">
                    {i.source || i.collection?.name || "Сохранено вами"}
                  </small>
                  <h3>{i.title}</h3>
                  {i.tags.length > 0 && (
                    <div className="tags">
                      {i.tags.map((t) => (
                        <button
                          key={t}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTag(t);
                          }}
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  )}
                  <footer>
                    <span>{i.collection?.name || "Входящие"}</span>
                    <span>
                      {new Date(i.createdAt).toLocaleDateString("ru", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        )}
        {cursor && (
          <button className="load-more" onClick={more}>
            Показать ещё
          </button>
        )}
        <div className="mobile-collections">
          <select
            aria-label="Коллекция"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
          >
            <option value="">Все сохранённое</option>
            <option value="inbox">Входящие</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button onClick={addCollection}>＋ Коллекция</button>
        </div>
      </main>
      {modal && (
        <div className="overlay" onClick={() => !busy && setModal(false)}>
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Сохранённое"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-top">
              <h2>{selected ? "Ваша находка" : "Новая находка"}</h2>
              <button
                disabled={busy}
                aria-label="Закрыть"
                onClick={() => setModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={save}>
              {!selected && (
                <>
                  <label>
                    Ссылка
                    <input
                      type="url"
                      placeholder="https://…"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </label>
                  <label className="upload">
                    ＋ Фото или видео до 20 МБ
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    {file && <small>{file.name}</small>}
                  </label>
                </>
              )}
              {selected?.mediaUrl &&
                (selected.type === "video" ? (
                  <video
                    className="detail-media"
                    src={selected.mediaUrl}
                    controls
                  />
                ) : (
                  <img
                    className="detail-media"
                    src={selected.mediaUrl}
                    alt={selected.title}
                  />
                ))}
              {selected?.url && (
                <a
                  className="original"
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Открыть оригинал ↗
                </a>
              )}
              <label>
                Название
                <input
                  value={title}
                  maxLength={300}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Заметка
                <textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <label>
                Коллекция
                <select
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                >
                  <option value="">Входящие</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Теги через запятую
                <input
                  placeholder="вдохновение, почитать"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </label>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <div className="dialog-actions">
                {selected && (
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={remove}
                  >
                    Удалить
                  </button>
                )}
                <button
                  className="primary"
                  disabled={busy || (!title.trim() && !url && !text && !file)}
                >
                  {busy ? "Сохраняем…" : "Сохранить"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
