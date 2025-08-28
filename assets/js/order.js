// Auto-fill today's date into startDate and endDate if empty
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
const todayStr = `${yyyy}-${mm}-${dd}`;
if (startEl && !startEl.value) startEl.value = todayStr;
if (endEl && !endEl.value) endEl.value = todayStr;
recalc();

function renderAvailableItems() {
    const container = document.getElementById('itemsContainer');
    if (!container) return;

    container.innerHTML = '';

    products.forEach(product => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'item';

        const icon = document.createElement('img');
        icon.src = product.icon;
        icon.alt = product.name;
        icon.className = 'item-icon';

        const name = document.createElement('span');
        name.className = 'item-name';
        name.textContent = product.name;

        const price = document.createElement('span');
        price.className = 'item-price';
        price.textContent = `$${product.price.toFixed(2)}`;

        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.min = 0;
        quantityInput.value = 0;
        quantityInput.className = 'item-quantity';
        quantityInput.dataset.productId = product.id;
        quantityInput.addEventListener('change', recalc);

        itemDiv.appendChild(icon);
        itemDiv.appendChild(name);
        itemDiv.appendChild(price);
        itemDiv.appendChild(quantityInput);

        container.appendChild(itemDiv);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    renderAvailableItems();
});