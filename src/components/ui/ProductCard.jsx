export default function ProductCard({ product }) {
  return (
    <div className="product-card">
      <div className="product-image-placeholder">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} />
        ) : (
          <span className="material-symbols-outlined">inventory_2</span>
        )}
      </div>
      <div className="product-info">
        <h4 className="product-name" title={product.name}>{product.name}</h4>
        <div className="product-footer">
          <span className="product-price">₹{product.price}</span>
          <span className="product-stock">{product.stock} in stock</span>
        </div>
      </div>
    </div>
  );
}
