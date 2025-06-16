import React, { useState, useEffect } from "react";
import useMovie from "../hooks/useMovie";
import MovieCart from "../components/movieCart";
import { Dropdown } from 'primereact/dropdown';
import useCategory from "../hooks/useCategory";

function Movies() {
    const orders = ["created", "rating", "imdb", "title", "view"];
    const [order, setOrder] = useState("created");
    const [filter, setFilter] = useState(0);

    const { Movies, getMovies, getMore, error, pending } = useMovie();
    const { Categories, getCategories } = useCategory();

    // درخواست داده‌ها
    useEffect(() => {
        getCategories();
        getMovies(order, filter);
    }, [filter, order]);

    const handleScroll = (e) => {
        const isEnd = e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight;
        if (isEnd) getMore(order, filter);
    };

    return (
        <div 
            className="movies" 
            style={{ 
                background: 'linear-gradient(135deg,rgb(24, 23, 23),rgb(255, 255, 255),rgb(41, 39, 39))', // گرادیانت اضافه‌شده
                minHeight: '100vh', 
                padding: '20px' 
            }}
        >
            {/* نمایش داده‌ها */}
            <div className="container" onScroll={handleScroll}>
                <div className="filters">
                    <Dropdown
                        value={filter}
                        onChange={(e) => setFilter(e.value)}
                        options={Categories}
                        optionLabel="title"
                        optionValue="id"
                        className="filter w-full md:w-14rem"
                    />
                    <Dropdown
                        value={order}
                        onChange={(e) => setOrder(e.value)}
                        options={orders}
                        className="order w-full md:w-14rem"
                    />
                </div>
                <div className="list grid">
                    {Movies && Movies.map(movie => (
                        <div className="item col" key={movie.id}>
                            <MovieCart movie={movie} />
                        </div>
                    ))}
                </div>

                {!pending && (
                    <div className="load-more-div">
                        <button className="load-more-btn" onClick={() => getMore(order, filter)}>
                            Load More
                        </button>
                    </div>
                )}
            </div>
            
            {/* تبلیغ تلگرام */}
            <div className="telegram-ad" style={{ textAlign: "center", padding: "10px", background: "#f8f9fa", marginTop: "20px" }}>
                <p>برای دریافت آخرین فیلم‌ها به کانال تلگرام ما بپیوندید!</p>
                <a 
                    href="https://t.me/Havij_Ezit_Ats" 
                    target="_blank" 
                    onClick={() => window.open('https://t.me/Havij_Ezit_Ats', '_blank')} 
                    style={{ color: "#007bff", textDecoration: "none", fontWeight: "bold" }}
                >
                    عضویت در تلگرام
                </a>
            </div>
        </div>
    );
}

export default Movies;