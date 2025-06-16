import React, { useState, useEffect } from "react";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MovieList from "../components/movieList";
import useHomeData from "../hooks/useHomeData";

function Home() {
    const { Data, getData, error, pending } = useHomeData();

    // درخواست داده‌ها
    useEffect(() => {
        getData();
    }, []);

    // نمایش نوتیفیکیشن خوش آمدید
    useEffect(() => {
        toast.info("Havij Movie", {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
        });
    }, []);

    return (
        <div 
            className="home" 
            style={{ 
                background: 'linear-gradient(135deg,rgb(24, 23, 23),rgb(255, 255, 255),rgb(41, 39, 39))', // گرادیانت اضافه‌شده
                minHeight: '100vh', 
                padding: '20px' 
            }}
        >
            {/* نمایش داده‌ها */}
            <div className="data">
                {Data.genres && Data.genres.map((item, i) => (
                    <MovieList key={i} movies={item.posters} title={item.title} />
                ))}
            </div>

            {/* اضافه کردن ToastContainer برای نمایش نوتیفیکیشن‌ها */}
            <ToastContainer />
        </div>
    );
}

export default Home;