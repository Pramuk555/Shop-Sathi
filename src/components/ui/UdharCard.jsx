import { useLanguage } from '../../context/LanguageContext';

export default function UdharCard({ udhar, onMarkPaid }) {
  const { t } = useLanguage();
  return (
    <div className="udhar-card">
      <div className="udhar-avatar">
        <span className="material-symbols-outlined">person</span>
      </div>
      
      <div className="udhar-details">
        <h4 className="customer-name">{udhar.customerName || 'Unknown'}</h4>
        <p className="udhar-date">{udhar.date}</p>
        <button className="mark-paid-btn" onClick={() => onMarkPaid(udhar)}>
          {t('full_pay') || 'Mark Paid'}
        </button>
      </div>

      <div className="udhar-amount-col">
        <span className="udhar-amount">₹{udhar.amount}</span>
        <div className="udhar-status pending">{t('pending') || 'Pending'}</div>
      </div>
    </div>
  );
}
