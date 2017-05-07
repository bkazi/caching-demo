'use strict';

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')

}

const values = [1,2,3,4,5,6,7,8,9,10,11,12,13,14];

const grid = document.querySelector('.masonry-grid');
const moreImages = document.querySelector('#more');
let timeout;

const addPictures = () => {
    values.map((item) => {
        const img = new Image();
        img.onload = () => {
            grid.appendChild(img);
        };
        img.src = `imgs/${item}-min.jpg`;
    });
};

moreImages.addEventListener('click', addPictures);

window.onload = () => {
    addPictures();
};
