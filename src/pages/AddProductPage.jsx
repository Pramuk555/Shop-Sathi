import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
export default function AddProductPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [product, setProduct] = useState({
    name: '',
    price: '',
    stock: '',
    categoryId: '1',
  });
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API save
    await new Promise(resolve => setTimeout(resolve, 800));
    setLoading(false);
    navigate('/inventory');
  };

  const handleImagePicker = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="add-product-container">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go Back">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-h4">Add Product</h1>
        <div style={{ width: 40 }}></div> {/* Spacer for centering */}
      </header>

      <form className="add-product-form" onSubmit={handleSubmit}>
        <div className="image-picker-section" onClick={handleImagePicker}>
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" className="image-preview" />
          ) : (
            <div className="image-placeholder">
              <span className="material-symbols-outlined">add_a_photo</span>
              <p>Add Image</p>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageChange} 
            accept="image/*" 
            hidden 
          />
        </div>

        <div className="form-group">
          <label>Product Name</label>
          <input 
            type="text" 
            required 
            placeholder="e.g. Aashirvaad Atta 5kg"
            value={product.name}
            onChange={e => setProduct({...product, name: e.target.value})}
          />
        </div>

        <div className="form-group row-group">
          <div className="form-group flex-1">
            <label>Price (₹)</label>
            <input 
              type="number" 
              required 
              placeholder="0"
              value={product.price}
              onChange={e => setProduct({...product, price: e.target.value})}
            />
          </div>
          <div className="form-group flex-1">
            <label>Opening Stock</label>
            <input 
              type="number" 
              required 
              placeholder="0"
              value={product.stock}
              onChange={e => setProduct({...product, stock: e.target.value})}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Category</label>
          <div className="select-wrapper">
            <select 
              value={product.categoryId}
              onChange={e => setProduct({...product, categoryId: e.target.value})}
            >
              <option value="1">Groceries</option>
              <option value="2">Snacks</option>
              <option value="3">Beverages</option>
            </select>
            <span className="material-symbols-outlined select-icon">expand_more</span>
          </div>
        </div>

        <button type="submit" className="gradient-btn submit-btn" disabled={loading}>
          {loading ? <span className="spinner"></span> : <span>Save Product</span>}
        </button>
      </form>
    </div>
  );
}
