import React, { useState, useEffect } from "react";
import useMovie from "../hooks/useMovie";
import { useData } from "../contexts/data";
import MovieCart from "../components/movieCart";

function Favorites() {
    const { Favorites, getFavorites, pending } = useMovie();
    const { userData } = useData();

    // درخواست داده‌ها برای لیست علاقه‌مندی‌ها
    useEffect(() => {
        if (userData) {
            getFavorites(userData.favorites);
        }
    }, [userData]);

    return (
        <div 
            className="favorites" 
            style={{ 
                background: 'linear-gradient(135deg,rgb(24, 23, 23),rgb(255, 255, 255),rgb(41, 39, 39))', // گرادیانت اضافه‌شده
                minHeight: '100vh', 
                padding: '20px' 
            }}
        >
            {/* نمایش لیست علاقه‌مندی‌ها */}
            <div className="container">
                <div className="list grid">
                    {Favorites && Favorites.map(movie => (
                        <div className="item col" key={movie.id}>
                            <MovieCart movie={movie} />
                        </div>
                    ))}

                    {pending && (
                        <div className="loading">
                            <p> Loading...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// استایل‌ها (بدون تغییر)
const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    loading: {
        padding: '20px',
        textAlign: 'center',
        color: '#ff4d4d',
    },
};

export default Favorites;