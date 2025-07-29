// Глобальные переменные
let isManualSelection = false;
let scrollTimeout = null;
let categories = [];
let coupons = {};

// ========================
// Основные функции
// ========================

// Загрузка данных
async function loadData() {
    try {
        const [categoriesRes, couponsRes] = await Promise.all([
            fetch('data/categories.json'),
            fetch('data/coupons.json')
        ]);
        
        categories = await categoriesRes.json();
        coupons = await couponsRes.json();
        
        // Сортируем купоны в каждой категории по цене (от дешевых к дорогим)
        for (const category in coupons) {
            coupons[category].sort((a, b) => {
                // Извлекаем число из строки с ценой (удаляем " ₽" и заменяем запятые на точки, если есть)
                const priceA = parseFloat(a.price.replace(/[^\d.,]/g, '').replace(',', '.'));
                const priceB = parseFloat(b.price.replace(/[^\d.,]/g, '').replace(',', '.'));
                return priceA - priceB; // Сортировка по возрастанию
            });
        }
        
        renderCategories();
        renderCoupons();
        initEventListeners();
        updateHighlight(0);
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showErrorMessage();
    }
}

// Показать сообщение об ошибке
function showErrorMessage() {
    const main = document.querySelector('main');
    main.innerHTML = `
        <div class="error-message">
            <p>Не удалось загрузить данные. Пожалуйста, попробуйте позже.</p>
        </div>
    `;
}

// ========================
// Рендер элементов
// ========================

// Рендер категорий
function renderCategories() {
    const carousel = document.querySelector('.carousel');
    carousel.innerHTML = '<div class="highlight"></div>';
    
    // Фильтруем категории с купонами
    const validCategories = categories.filter(cat => 
        coupons[cat.id] && coupons[cat.id].length > 0
    );
    
    if (validCategories.length === 0) {
        document.querySelector('main').innerHTML = `
            <div class="empty-message">
                <p>Нет доступных купонов</p>
            </div>
        `;
        return;
    }
    
    validCategories.forEach((category, index) => {
        const item = document.createElement('div');
        item.className = 'carousel-item';
        item.dataset.id = category.id;
        
        item.innerHTML = `
            <img src="static/images/${category.image}" alt="${category.name}" loading="lazy">
            <p>${category.name}</p>
        `;
        
        carousel.appendChild(item);
    });
}


function renderCoupons() {
    const main = document.querySelector('main');
    main.innerHTML = '';

    const svgPlaceholder = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 256" style="width:100%;height:auto;display:block;"><style>@font-face{font-family:'Flame';src:local('Flame Regular'),local('Flame-Regular'),url('Flame-Regular.otf') format('opentype');font-weight:400;font-style:normal;font-display:swap;}.bg{fill:#f5ecdc;}.icon{fill:#e0cba8;}.text{font-family:'Flame',sans-serif;font-size:24px;fill:#ccb896;text-anchor:middle;}</style><rect width="100%" height="100%" class="bg" rx="16"/><g transform="translate(100,40)"><rect width="200" height="140" rx="12" class="icon"/><circle cx="48" cy="36" r="16" class="bg"/><path class="bg" d="M40 110 L80 70 L120 110 L160 80 L200 120 L200 140 L40 140 Z"/></g><text x="200" y="230" class="text">Съели не запечатлев...</text></svg>`;

    categories.forEach(category => {
        const categoryCoupons = coupons[category.id];
        if (!categoryCoupons || categoryCoupons.length === 0) return;

        const section = document.createElement('section');
        section.className = 'coupon-section';
        section.id = category.id;

        section.innerHTML = `
            <h2>${category.name}</h2>
            <div class="coupon-list"></div>
        `;

        const couponList = section.querySelector('.coupon-list');

        categoryCoupons.forEach(item => {
            const card = document.createElement('div');
            card.className = 'coupon-card';

            const imagePath = item.image.startsWith('http') ?
                item.image : `static/images/${item.image}`;

            card.dataset.img = imagePath;
            card.dataset.title = item.title;
            card.dataset.description = item.description.replace(/\n/g, '\\n');
            card.dataset.price = item.price;
            card.dataset.old = item.old_price;
            card.dataset.codes = item.codes.join(',');

            const img = document.createElement('img');
            img.src = imagePath;
            img.loading = 'lazy';

            const title = document.createElement('h3');
            title.textContent = item.title;

            const price = document.createElement('div');
            price.className = 'price';

            if ((item.price && item.old_price) && (item.price == item.old_price)) {
                price.textContent = item.price;
            } else if (item.old_price === '') {
                price.textContent = item.price;
            } else {
                price.innerHTML = `${item.price} <s>${item.old_price}</s>`;
            }

            // Проверка загрузки изображения
            const testImg = new Image();
            testImg.src = imagePath;
            testImg.onload = () => {
                card.prepend(img);
            };
            testImg.onerror = () => {
                const temp = document.createElement('div');
                temp.innerHTML = svgPlaceholder;
                const svg = temp.firstChild;
                //svg.classList.add('fade-in');
                card.prepend(svg);
            };

            card.appendChild(title);
            card.appendChild(price);
            couponList.appendChild(card);
        });

        main.appendChild(section);
    });
}



// ========================
// Обработчики событий
// ========================

function initEventListeners() {
    // Категории
    document.querySelectorAll('.carousel-item').forEach((el, index) => {
        el.addEventListener('click', () => handleCategoryClick(el, index));
    });
    
    // Купоны (модальное окно)
    document.addEventListener('click', (e) => {
        const card = e.target.closest('.coupon-card');
        if (card) handleCouponClick(card);
    });
    
    // Закрытие модального окна
    document.querySelector('.close').addEventListener('click', closeModal);
    
    // Обработчик скролла
    window.addEventListener('scroll', throttleScroll);
}

function handleCategoryClick(el, index) {
    isManualSelection = true;
    
    const id = el.dataset.id;
    const element = document.getElementById(id);
    if (!element) return;
    
    const y = element.getBoundingClientRect().top + window.scrollY - 145;
    window.scrollTo({ top: y, behavior: 'smooth' });
    updateHighlight(index);
    
    setTimeout(() => {
        isManualSelection = false;
    }, 1000);
}

function handleCouponClick(card) {
    const modal = document.getElementById('couponModal');
    modal.classList.remove('hide'); // Убираем hide, если есть
    modal.style.display = 'flex';
    modal.classList.add('show'); // Триггерим анимацию появления
    modal.querySelector('.modal-content').classList.add('animate-in'); // Анимация увеличения


    const svgPlaceholder = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 256" style="width:100%;height:auto;display:block;"><style>@font-face{font-family:'Flame';src:local('Flame Regular'),local('Flame-Regular'),url('Flame-Regular.otf') format('opentype');font-weight:400;font-style:normal;font-display:swap;}.bg{fill:#f5ecdc;}.icon{fill:#e0cba8;}.text{font-family:'Flame',sans-serif;font-size:24px;fill:#ccb896;text-anchor:middle;}</style><rect width="100%" height="100%" class="bg" rx="16"/><g transform="translate(100,40)"><rect width="200" height="140" rx="12" class="icon"/><circle cx="48" cy="36" r="16" class="bg"/><path class="bg" d="M40 110 L80 70 L120 110 L160 80 L200 120 L200 140 L40 140 Z"/></g><text x="200" y="230" class="text">Съели не запечатлев...</text></svg>`;

    // Очистим содержимое контейнера изображения в модалке
    const imageContainer = document.getElementById('modalImage');
    imageContainer.innerHTML = ''; // modalImage должен быть <div>, не <img>

    // Проверка загрузки изображения
    const imagePath = card.dataset.img;
    const testImg = new Image();
    testImg.src = imagePath;

    testImg.onload = () => {
        const img = document.createElement('img');
        img.src = imagePath;
        img.alt = '';
        img.loading = 'lazy';
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        imageContainer.innerHTML = '';
        imageContainer.appendChild(img);
    };

    testImg.onerror = () => {
        const temp = document.createElement('div');
        temp.innerHTML = svgPlaceholder;
        const svg = temp.firstChild;
        svg.classList.add('fade-in');
        imageContainer.innerHTML = '';
        imageContainer.appendChild(svg);
    };

    // Заполнение текста
    document.getElementById('modalTitle').textContent = card.dataset.title;

    const description = card.dataset.description.replace(/\\n/g, '\n');
    if (description === '') {
        document.getElementById('modalDesc').innerHTML = `<i>Информации нет...</i>`;
    } else {
        document.getElementById('modalDesc').textContent = description;
    }

    // Цены
    const priceBlock = document.getElementById('modalPrice');
    if ((card.dataset.price && card.dataset.old) && (card.dataset.price === card.dataset.old)) {
        priceBlock.innerHTML = `<span class="current">${card.dataset.price}</span>`;
    } else if (card.dataset.old === '') {
        priceBlock.innerHTML = `<span class="current">${card.dataset.price}</span>`;
    } else {
        priceBlock.innerHTML = `
            <span class="current">${card.dataset.price}</span>
            <span class="old">от ${card.dataset.old}</span>
        `;
    }

    // Коды
    const codesDiv = document.getElementById('modalCodes');
    codesDiv.innerHTML = '';
    card.dataset.codes.split(',').forEach(code => {
        const btn = document.createElement('button');
        btn.textContent = code;
        btn.addEventListener('click', () => copyCode(btn, code));
        codesDiv.appendChild(btn);
    });

    // Прокрутка описания
    // Прокрутка описания — задержка нужна для корректной высоты после анимации
    const descContainer = document.querySelector('.description-container');
    descContainer.classList.remove('scrollable');
    
    requestAnimationFrame(() => {
        setTimeout(() => {
            if (descContainer.scrollHeight > descContainer.clientHeight + 1) {
                descContainer.classList.add('scrollable');
            }
        }, 10); // небольшая задержка на отрисовку
    });
}

function closeModal() {
    const modal = document.getElementById('couponModal');
    const modalContent = modal.querySelector('.modal-content');

    modal.classList.remove('show');
    modal.classList.add('hide');
    modalContent.classList.remove('animate-in');

    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('hide');
    }, 300); // Должно совпадать с CSS-анимацией
}


// Функция копирования
function copyCode(btn, code) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(code).then(() => {
            showCopied(btn, code);
        }).catch(err => {
            console.warn('Clipboard API не сработал, пробуем fallback:', err);
            fallbackCopyText(btn, code);
        });
    } else {
        fallbackCopyText(btn, code);
    }
}

function fallbackCopyText(btn, code) {
    const textarea = document.createElement('textarea');
    textarea.value = code;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopied(btn, code);
        } else {
            throw new Error('execCommand вернул false');
        }
    } catch (err) {
        console.error('Ошибка копирования (fallback):', err);
        btn.textContent = 'Ошибка!';
        setTimeout(() => {
            btn.textContent = code;
        }, 1500);
    }

    document.body.removeChild(textarea);
}

function showCopied(btn, original) {
    btn.textContent = 'Скопировано!';
    setTimeout(() => {
        btn.textContent = original;
    }, 1500);
}


// ========================
// Функции скролла и подсветки
// ========================

function scrollCarouselToActive(index) {
    const carousel = document.querySelector('.carousel');
    const items = document.querySelectorAll('.carousel-item');
    const item = items[index];
    
    if (!carousel || !item) return;
    
    const carouselWidth = carousel.offsetWidth;
    const itemLeft = item.offsetLeft;
    const itemWidth = item.offsetWidth;
    const scrollTo = itemLeft - (carouselWidth / 2) + (itemWidth / 2);
    
    carousel.scrollTo({
        left: scrollTo,
        behavior: 'smooth'
    });
}

function updateHighlight(index) {
    const highlight = document.querySelector('.highlight');
    const items = document.querySelectorAll('.carousel-item');
    
    if (highlight && items[index]) {
        highlight.style.left = items[index].offsetLeft + 'px';
        highlight.style.width = items[index].offsetWidth + 'px';
        scrollCarouselToActive(index);
        
        // Обновляем активный класс
        items.forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
    }
}

function isSectionMajorityVisible(section) {
    const rect = section.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0) - 100;
    
    // Секция активна, если видно больше половины экрана
    return visibleHeight > Math.min(section.offsetHeight / 2, windowHeight / 2);
}

function updateActiveCategoryOnScroll() {
    if (isManualSelection) return;
    
    const sections = document.querySelectorAll('.coupon-section');
    const items = document.querySelectorAll('.carousel-item');
    let activeIndex = -1;
    
    sections.forEach((section, index) => {
        if (activeIndex === -1 && isSectionMajorityVisible(section)) {
            activeIndex = index;
        }
    });
    
    if (activeIndex !== -1) {
        updateHighlight(activeIndex);
    }
}

function throttleScroll() {
    if (scrollTimeout) return;
    
    scrollTimeout = setTimeout(() => {
        updateActiveCategoryOnScroll();
        scrollTimeout = null;
    }, 100);
}

// ========================
// Инициализация
// ========================

// Запуск при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    loadData();
    
    // Резервная проверка на случай, если данные загрузились быстро
    setTimeout(() => {
        if (document.querySelectorAll('.carousel-item').length > 0) {
            updateHighlight(0);
        }
    }, 500);
});
