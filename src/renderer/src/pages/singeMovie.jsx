import React, { useState, useEffect, useRef } from "react";
import { Dropdown } from 'primereact/dropdown';
import useCategory from "../hooks/useCategory";
import useSerie from "../hooks/useSerie";
import MovieCart from "../components/movieCart";

function Series() {
    const orders = ["created", "rating", "imdb", "title", "view"];
    const [order, setOrder] = useState("created");
    const [filter, setFilter] = useState(0);

    const { Series, getSeries, getMore, error, pending } = useSerie();
    const { Categories, getCategories } = useCategory();

    useEffect(() => {
        getCategories();
        getSeries(order, filter);
    }, [filter, order]);

    const handleScroll = (e) => {
        const isEnd = e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight;
        if (isEnd) getMore(order, filter);
    };

    return (
        <div 
            className="series" 
            style={{ 
                background: 'linear-gradient(135deg, #8e2de2, #4a00e0, #9400d3)', 
                minHeight: '100vh', 
                padding: '20px' 
            }}
        >
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
                    {Series && Series.map(series => (
                        <div className="item col" key={series.id}>
                            <MovieCart movie={series} />
                        </div>
                    ))}
                </div>

                {pending && (
                    <div className="loading">
                        <p> Loading...</p>
                    </div>
                )}

                {!pending && (
                    <div className="load-more-div">
                        <button className="load-more-btn" onClick={() => getMore(order, filter)}>
                            Load More
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Series;