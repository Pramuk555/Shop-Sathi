export default function BillItemCard({ product, quantity, onAdd, onRemove }) {
  return (
    <div className="bill-item-card">
      <div className="item-info">
        <h4>{product.name}</h4>
        <p>₹{product.price} / unit</p>
      </div>

      <div className="item-actions">
        {quantity > 0 ? (
          <div className="qty-controls">
            <button className="qty-btn" onClick={() => onRemove(product)} aria-label="Decrease">
              <span className="material-symbols-outlined">remove</span>
            </button>
            <span className="qty-value">{quantity}</span>
            <button className="qty-btn" onClick={() => onAdd(product)} aria-label="Increase">
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
        ) : (
          <button className="add-item-btn" onClick={() => onAdd(product)}>
            Add
          </button>
        )}
      </div>
    </div>
  );
}
