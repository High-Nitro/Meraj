import React from "react";

function About() {
    const handleLink = (e) => {
        e.preventDefault();
        window.api.openLinkInChrome("سازنده نرم اقزار ایران موی : معراج");
    };

    const handleLinkGit = (e) => {
        e.preventDefault();
        window.api.openLinkInChrome("خریداش");
    };

    return (
        <div style={styles.container}>
            <div style={styles.content}>
                <h1 style={styles.title}>هویج مووی</h1>
                <p style={styles.description}>
                    خوش آمدید
                </p>
                <p style={styles.description}>
                   فیلم و سریال هارو با هویج مووی بدون سانسور تجربه کن  
                </p>
                <br />
                <div style={styles.links}>
                    <a
                        href="خرید اشتراک"
                        onClick={handleLink}
                        style={styles.link}
                    >
                        Version : Free
                    </a>
                    <a
                        href="سازنده نرم اقزار ایران موی : معراج"
                        onClick={handleLinkGit}
                        style={styles.link}
                    >
                        Developer : Meraj
                    </a>
                </div>
            </div>
            <div style={styles.snow}></div>
        </div>
    );
}

// استایل‌های پیشرفته برای صفحه About
const styles = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg,rgb(24, 23, 23),rgb(255, 255, 255),rgb(41, 39, 39))', // گرادیانت اضافه‌شده
        color: '#fff',
        fontFamily: 'Arial, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        padding: '20px',
    },
    content: {
        textAlign: 'center',
        maxWidth: '600px',
        background: 'rgba(42, 42, 64, 0.9)',
        padding: '50px',
        borderRadius: '20px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
        border: '2px solidrgb(64, 71, 70)',
        position: 'relative',
        zIndex: '2',
        backdropFilter: 'blur(10px)',  // Adds a blur effect to the background
    },
    title: {
        fontSize: '40px',
        fontWeight: 'bold',
        marginBottom: '20px',
        background: 'linear-gradient(135deg,rgb(24, 23, 23),rgb(255, 255, 255),rgb(41, 39, 39))', // گرادیانت اضافه‌شده
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        textShadow: '2px 2px 5px rgba(0, 0, 0, 0.3)', // Adds a text shadow
    },
    description: {
        fontSize: '20px',
        lineHeight: '1.6',
        marginBottom: '20px',
        fontWeight: '300', // Makes the description text lighter
    },
    links: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
    },
    link: {
        color: '(64, 71, 70)',
        textDecoration: 'none',
        fontSize: '18px',
        fontWeight: '500',
        transition: 'color 0.3s ease',
        position: 'relative',
        padding: '5px',
        borderRadius: '5px',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',  // Adds a subtle shadow to the links
    },
    snow: {
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        zIndex: '-1',
        pointerEvents: 'none',
        animation: 'snowFall 10s infinite linear',
    },
};

// افکت برف با انیمیشن CSS
const snowAnimation = `
@keyframes snowFall {
    0% { transform: translateY(-100px); opacity: 1; }
    20% { opacity: 0.9; }
    50% { opacity: 0.5; }
    80% { opacity: 0.8; }
    100% { transform: translateY(100vh); opacity: 0; }
}

.snow {
    background: url("https://cdn.pixabay.com/photo/2017/11/13/19/19/snow-2948430_960_720.jpg") repeat center center;
    animation: snowFall 15s infinite linear;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
}
`;

const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = snowAnimation;
document.head.appendChild(styleSheet);

export default About;