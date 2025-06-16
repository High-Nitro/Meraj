import { Link } from "react-router-dom";
import { useSearch } from "../contexts/search";

function NavItem({ label, to }) {
  return (
    <Link to={to} className="item">
      {label}
    </Link>
  );
}

function Header() {
  const { searchText, setSearchText } = useSearch();

  return (
    <div 
      className="header container" 
      style={{ 
        background: 'linear-gradient(135deg,rgb(41, 37, 37),rgb(255, 255, 255),rgb(35, 37, 36))', 
        padding: '20px', 
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)' 
      }}
    >
      <div className="main grid">
        <div className="logo col-3" style={styles.logo}>
          <h1 style={styles.logoText}>Havij Movie</h1>
        </div>
        <div className="search col-6" style={styles.search}>
          <input
            type="text"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
            }}
            style={styles.searchInput}
            placeholder="جستجو کنید..."
          />
          <i className="pi pi-search" style={styles.searchIcon}></i>
        </div>
      </div>
      <div className="nav">
        <NavItem label="صفحه اصلی" to="/" />
        <NavItem label="فیلم ها" to="/movies" />
        <NavItem label="سریال ها" to="/series" />
        <NavItem label="مورد علاقه ها" to="/favorites" />
        <NavItem label="درباره ما" to="/about" />
      </div>
    </div>
  );
}

export default Header;

// استایل‌ها برای هدر
const styles = {
  logo: {
    fontSize: "32px",
    fontWeight: "bold",
    letterSpacing: "2px",
    color: "#00ffcc",
    textAlign: "center",
    position: "relative",
    zIndex: "2",
  },
  logoText: {
    fontSize: "36px",
    fontWeight: "bold",
    background: "linear-gradient(45deg,rgb(88, 86, 86),rgb(0, 0, 0))",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    textShadow: "3px 3px 5px rgba(0, 0, 0, 0.2)",
    animation: "pulse 1.5s infinite ease-in-out",
  },
  search: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: "50%",  // حداکثر عرض فیلد جستجو
    paddingLeft: "1px", // فاصله بیشتر از سمت چپ
  },
  searchInput: {
    width: "100%",
    padding: "1px 15px",
    borderRadius: "30px",
    border: "2px solid #00ffcc",
    backgroundColor: "rgb(255, 255, 255)",
    color: "#fff",
    fontSize: "16px",
    outline: "none",
    transition: "border-color 0.3s ease",
  },
  searchIcon: {
    position: "absolute",
    top: "50%",
    right: "-10px",
    transform: "translateY(-50%)",
    color: "#fff",
  },
  nav: {
    display: "flex",
    justifyContent: "center", // تغییر به مرکز برای کاهش فاصله‌ها
    marginTop: "20px",
    gap: "20px", // فاصله کمتر بین آیتم‌های ناوبری
  },
};

// افکت انیمیشن لوگو
const logoAnimation = `
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
`;

const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = logoAnimation;
document.head.appendChild(styleSheet);