export default function CategoryCard({ category, isSelected, onClick }) {
  return (
    <div 
      className={`category-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="category-icon-wrapper">
        <span className="material-symbols-outlined">{category.icon || 'category'}</span>
      </div>
      <span className="category-name">{category.name}</span>
    </div>
  );
}
