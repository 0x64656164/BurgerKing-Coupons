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

// Рендер купонов
function renderCoupons() {
    const main = document.querySelector('main');
    main.innerHTML = '';
    
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
            
            if ((card.dataset.price && card.dataset.old) && (card.dataset.price == card.dataset.old)) {
                card.innerHTML = `
                    <img src="${imagePath}" alt="${item.title}" loading="lazy">
                    <h3>${item.title}</h3>
                    <div class="price">${item.price}</div>
                `;
            } else if (card.dataset.old === '') {
                card.innerHTML = `
                    <img src="${imagePath}" alt="${item.title}" loading="lazy">
                    <h3>${item.title}</h3>
                    <div class="price">${item.price}</div>
                `;
            } else {
                card.innerHTML = `
                    <img src="${imagePath}" alt="${item.title}" loading="lazy">
                    <h3>${item.title}</h3>
                    <div class="price">${item.price} <s>${item.old_price}</s></div>
                `;
            };
            
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
    modal.style.display = 'flex';
    
    // Заполняем данные модального окна
    document.getElementById('modalImage').src = card.dataset.img;
    document.getElementById('modalTitle').textContent = card.dataset.title;
    
    const description = card.dataset.description.replace(/\\n/g, '\n');
    if (description == ''){
        document.getElementById('modalDesc').innerHTML = `<i>Информации нет...</i>`;
    } else {
        document.getElementById('modalDesc').textContent = description;
    }
    
    if ((card.dataset.price && card.dataset.old) && (card.dataset.price === card.dataset.old)) {
        document.getElementById('modalPrice').innerHTML = `
        <span class="current">${card.dataset.price}</span>
    `;
    } else if (card.dataset.old === '') {
        document.getElementById('modalPrice').innerHTML = `
        <span class="current">${card.dataset.price}</span>
    `;
    }  else {
        document.getElementById('modalPrice').innerHTML = `
        <span class="current">${card.dataset.price}</span>
        <span class="old">от ${card.dataset.old}</span>
    `;
    };
    
    // Генерация кнопок с кодами
    const codesDiv = document.getElementById('modalCodes');
    codesDiv.innerHTML = '';
    
    card.dataset.codes.split(',').forEach(code => {
        const btn = document.createElement('button');
        btn.textContent = code;
        btn.addEventListener('click', () => copyCode(btn, code));
        codesDiv.appendChild(btn);
    });
    
    const descContainer = document.querySelector('.description-container');
    // Удаляем класс, если был добавлен ранее
    descContainer.classList.remove('scrollable');
    
    // Проверяем, нужна ли прокрутка
    if (descContainer.scrollHeight > descContainer.clientHeight) {
        descContainer.classList.add('scrollable');
    }
}

function closeModal() {
    document.getElementById('couponModal').style.display = 'none';
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
