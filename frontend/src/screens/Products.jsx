import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { cleanNumeric, rupees } from '../utils.js';

const emptyForm = { product_id: '', name: '', cost: '', stock: '', contents: '' };

function ProductForm({ product, onClose, onSaved }) {
  const [form, setForm] = useState(
    product
      ? {
          product_id: product.product_id || '',
          name: product.name || '',
          cost: product.cost ? String(product.cost) : '',
          stock: product.stock ? String(product.stock) : '',
          contents: product.contents || '',
        }
      : emptyForm
  );
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(product?.image || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const firstRef = useRef(null);

  useEffect(() => {
    setTimeout(() => firstRef.current?.focus(), 60);
  }, []);

  // Enter walks this form the same way it walks a bill, so the two never feel
  // like different applications.
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA')
      return;
    e.preventDefault();
    const all = Array.from(e.currentTarget.querySelectorAll('[data-chain]'));
    const next = all[all.indexOf(e.target) + 1];
    if (next) {
      next.focus();
      next.select?.();
    }
  };

  const pickFile = (f) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!form.name.trim() || !form.product_id.trim()) {
      setError('A product needs both a name and an ID.');
      return;
    }
    setBusy(true);
    setError('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append('image', file);
    try {
      const saved = product
        ? await api.updateProduct(product.id, fd)
        : await api.createProduct(fd);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = (key, label, extra = {}) => (
    <label className="field">
      <span>{label}</span>
      <input
        data-chain={key}
        type="text"
        autoComplete="off"
        value={form[key]}
        onChange={(e) =>
          setForm((f) => ({
            ...f,
            [key]: extra.numeric ? cleanNumeric(e.target.value) : e.target.value,
          }))
        }
        placeholder={extra.placeholder || ''}
        inputMode={extra.numeric ? 'decimal' : undefined}
        ref={key === 'name' ? firstRef : undefined}
      />
    </label>
  );

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} role="presentation" />
      <div className="sheet sheet-wide" role="dialog" aria-label="Product">
        <div className="sheet-head">
          <h3>{product ? 'Edit product' : 'New product'}</h3>
        </div>
        <div className="product-form" onKeyDown={onKeyDown}>
          <label className="upload">
            {preview ? (
              <img src={preview} alt="" />
            ) : (
              <span className="upload-empty">
                <strong>Upload image</strong>
                <small>PNG or JPG</small>
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </label>
          <div className="product-fields">
            {field('name', 'Product name', { placeholder: 'Kitchen set large' })}
            {field('product_id', 'Product ID', { placeholder: 'KS-12' })}
            {field('cost', 'Cost', { numeric: true, placeholder: '0' })}
            {field('stock', 'In stock', { numeric: true, placeholder: '0' })}
            {field('contents', 'Contents', { placeholder: '24 pieces per box' })}
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="sheet-foot">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : product ? 'Save product' : 'Add product'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function Products({ settings, newSignal = 0 }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null); // { product } or { product: null }
  const cur = settings.currency || '₹';

  const load = (query) => {
    setLoading(true);
    api
      .products(query)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(() => load(q), q ? 160 : 0);
    return () => clearTimeout(t);
  }, [q]);

  // Ctrl+D from anywhere lands here with the form already open.
  useEffect(() => {
    if (newSignal > 0) setForm({ product: null });
  }, [newSignal]);

  const remove = async (p) => {
    if (!window.confirm(`Delete ${p.name}? Bills already raised keep their own copy.`)) return;
    await api.deleteProduct(p.id);
    load(q);
  };

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>Products</h2>
        <div className="head-tools">
          <input
            className="search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or ID"
          />
          <button
            type="button"
            className={editing ? 'chip on' : 'chip'}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
          <button type="button" className="primary" onClick={() => setForm({ product: null })}>
            + Add new
          </button>
        </div>
      </div>

      {loading ? (
        <p className="muted pad">Loading…</p>
      ) : items.length === 0 ? (
        <div className="empty">
          <p>{q ? 'Nothing matches that.' : 'No products yet.'}</p>
          {!q && (
            <button type="button" className="primary" onClick={() => setForm({ product: null })}>
              Add the first product
            </button>
          )}
        </div>
      ) : (
        <ul className="product-grid">
          {items.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="product-card"
                onClick={() => setForm({ product: p })}
              >
                {p.image ? (
                  <img src={p.image} alt="" />
                ) : (
                  <span className="no-image">No image</span>
                )}
                <span className="pc-body">
                  <strong>{p.name}</strong>
                  <span className="muted">{p.product_id}</span>
                  <span className="pc-cost">{rupees(p.cost, cur)}</span>
                  {p.contents ? <span className="muted small">{p.contents}</span> : null}
                  <span className={p.stock > 0 ? 'stock' : 'stock out'}>
                    {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                  </span>
                </span>
              </button>
              {editing && (
                <button type="button" className="del corner" onClick={() => remove(p)}>
                  del
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {form && (
        <ProductForm
          product={form.product}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load(q);
          }}
        />
      )}
    </div>
  );
}
