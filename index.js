'use strict';

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', {
        scope: 'caching-demo',
    })

}

const clientId = '57efb635002b823';
let page = 0;

const grid = document.querySelector('.masonry-grid');
const moreImages = document.querySelector('#more');
let timeout;

const addPictures = () => {
    fetch(`https://api.imgur.com/3/g/memes/viral/${page}`, {
        method: 'GET',
        headers: {
            'Authorization' : `Client-ID ${clientId}`,
        }
    })
    .then((res) => res.json())
    .then((json) => {
        json.data.map((item) => {
            const img = new Image();
            img.onload = () => {
                grid.appendChild(img);
            };
            img.src = item.link;
        });
        page++;
    })
    .catch(console.error);
};

moreImages.addEventListener('click', addPictures);

window.onload = () => {
    addPictures();
};
