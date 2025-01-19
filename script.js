const form = document.getElementById('calculator-form');
const resultsDiv = document.getElementById('results');
const distanceSpan = document.getElementById('distance');
const finalPriceSpan = document.getElementById('final-price');
const errorMessageDiv = document.getElementById('error-message');
const errorText = document.getElementById('error-text');

// Твій ключ OpenRouteService
const orsApiKey = '5b3ce3597851110001cf6248b339b39918914b0c86e8a8b9f8e39657';

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Плавне приховування результатів
    resultsDiv.classList.remove('show');
    resultsDiv.classList.add('hidden');
    errorMessageDiv.classList.remove('show');
    errorMessageDiv.classList.add('hidden');

    const formData = new FormData(form);
    const data = {};
    for (const [key, value] of formData) {
        data[key] = value;
    }

    try {
        // Визначення координат: спочатку перевіряємо ZIP, потім місто
        let originCoords, destinationCoords;
        if (data['origin-zip']) {
            originCoords = await getCoordinatesFromZip(data['origin-zip']);
        } else {
            originCoords = await getCoordinatesFromCity(data['origin-city']);
        }

        if (data['destination-zip']) {
            destinationCoords = await getCoordinatesFromZip(data['destination-zip']);
        } else {
            destinationCoords = await getCoordinatesFromCity(data['destination-city']);
        }

        if (!originCoords || !destinationCoords) {
            throw new Error('Invalid location data');
        }

        // Сформувати запит до OpenRouteService API
        const orsRequest = {
            coordinates: [originCoords, destinationCoords],
            profile: 'driving-car',
            format: 'json'
        };

        // Відправити запит до OpenRouteService API
        const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
            },
            body: JSON.stringify(orsRequest)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || 'OpenRouteService API error');
        }

        const orsResponse = await response.json();

        // Отримати відстань в милях
        const distanceMeters = orsResponse.routes[0].summary.distance;
        const distanceMiles = distanceMeters * 0.000621371;

        // Розрахувати базову вартість
        const baseCost = calculateBaseCost(distanceMiles, data.vehicleType, data.operable, data.trailerType, data.amount, data.expeditionary);

        // Додати фіксовану маржу
        const fixedMargin = parseFloat(data['fixed-margin']) || 0;

        // Додати доплату за Inop, якщо авто не на ходу
        const inopFee = (data.operable === 'false' && parseFloat(data['inop-fee'])) || 0;

        // Розрахувати кінцеву ціну
        const finalPrice = baseCost + fixedMargin + inopFee;

        // Показати результати
        distanceSpan.textContent = distanceMiles.toFixed(2);
        finalPriceSpan.textContent = finalPrice.toFixed(2);
        resultsDiv.classList.remove('hidden');
        resultsDiv.classList.add('show');
        errorMessageDiv.style.display = 'none';

    } catch (error) {
        console.error('Error:', error);
        errorText.textContent = error.message || 'An unexpected error occurred.';
        errorMessageDiv.classList.remove('hidden');
        errorMessageDiv.classList.add('show');
        resultsDiv.style.display = 'none';
    }
});

// Функція для розрахунку базової вартості (зміни її під свої потреби)
function calculateBaseCost(distance, vehicleType, operable, trailerType, amount, expeditionary) {
    let baseRate = 0.5; // Базова ставка за милю

    // Модифікатори в залежності від параметрів
    if (vehicleType === 'truck') baseRate *= 1.5;
    else if (vehicleType === 'suv') baseRate *= 1.2;

    if (trailerType === 'enclosed') baseRate *= 1.4;
    if (expeditionary) baseRate *= 1.7;

    return distance * baseRate * amount;
}

// Функція для отримання координат з поштового індексу (використовує Nominatim API)
async function getCoordinatesFromZip(zipCode) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&postalcode=${zipCode}&countrycodes=US`;

    try {
        const response = await fetch(nominatimUrl);
        if (!response.ok) {
          throw new Error('Nominatim API error');
        }
        const data = await response.json();

        if (data && data.length > 0) {
            return [parseFloat(data[0].lon), parseFloat(data[0].lat)]; // OpenRouteService очікує [довгота, широта]
        } else {
            throw new Error('Invalid ZIP code');
        }
    } catch (error) {
        console.error('Error fetching coordinates from Nominatim:', error);
        throw new Error('Error fetching coordinates');
    }
}

// Функція для отримання координат з назви міста (використовує Nominatim API)
async function getCoordinatesFromCity(cityName) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${cityName}&countrycodes=US`;

    try {
        const response = await fetch(nominatimUrl);
        if (!response.ok) {
            throw new Error('Nominatim API error');
        }
        const data = await response.json();

        if (data && data.length > 0) {
            return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
        } else {
            throw new Error('Invalid city name');
        }
    } catch (error) {
        console.error('Error fetching coordinates from Nominatim:', error);
        throw new Error('Error fetching coordinates');
    }
}
