const form = document.getElementById('calculator-form');
const resultsDiv = document.getElementById('results');
const distanceSpan = document.getElementById('distance');
const finalPriceSpan = document.getElementById('final-price');
const errorMessageDiv = document.getElementById('error-message');
const errorText = document.getElementById('error-text');

// Твій ключ OpenRouteService (заміни на свій)
const orsApiKey = '5b3ce3597851110001cf6248b339b39918914b0c86e8a8b9f8e39657';

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // 1. Плавне приховування результатів та повідомлень про помилки
    resultsDiv.classList.remove('show');
    resultsDiv.classList.add('hidden');
    errorMessageDiv.classList.remove('show');
    errorMessageDiv.classList.add('hidden');

    // 2. Отримання даних з форми
    const formData = new FormData(form);
    const data = {};
    for (const [key, value] of formData) {
        data[key] = value;
    }

    try {
        // 3. Визначення координат
        let originCoords, destinationCoords;

        // Спочатку перевіряємо ZIP код
        if (data['origin-zip']) {
            originCoords = await getCoordinatesFromZip(data['origin-zip']);
        } else if (data['origin-city']) {
            originCoords = await getCoordinatesFromCity(data['origin-city']);
        } else {
            throw new Error('Please enter an origin city or ZIP code.');
        }

        if (data['destination-zip']) {
            destinationCoords = await getCoordinatesFromZip(data['destination-zip']);
        } else if (data['destination-city']) {
            destinationCoords = await getCoordinatesFromCity(data['destination-city']);
        } else {
            throw new Error('Please enter a destination city or ZIP code.');
        }

        // Якщо не вдалося отримати координати
        if (!originCoords || !destinationCoords) {
            throw new Error('Could not determine coordinates for the given locations.');
        }

        // 4. Сформувати запит до OpenRouteService API
        const orsRequest = {
            coordinates: [originCoords, destinationCoords],
            profile: 'driving-car',
            format: 'json'
        };

        // 5. Відправити запит до OpenRouteService API
        const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=${orsApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
            },
            body: JSON.stringify(orsRequest)
        });

        // 6. Обробити відповідь від OpenRouteService API
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || 'OpenRouteService API error');
        }

        const orsResponse = await response.json();

        // 7. Отримати відстань в милях
        const distanceMeters = orsResponse.routes[0].summary.distance;
        const distanceMiles = distanceMeters * 0.000621371;

        // 8. Розрахувати базову вартість
        const baseCost = calculateBaseCost(distanceMiles, data.vehicleType, data.operable, data.trailerType, data.amount, data.expeditionary);

                // 9. Додати фіксовану маржу
                const fixedMargin = parseFloat(data['fixed-margin']) || 0;

                // 10. Додати доплату за Inop, якщо авто не на ходу
                const inopFee = (data.operable === 'false' && parseFloat(data['inop-fee'])) || 0;
        
                // 11. Розрахувати кінцеву ціну
                const finalPrice = baseCost + fixedMargin + inopFee;
        
                // 12. Показати результати
                distanceSpan.textContent = distanceMiles.toFixed(2);
                finalPriceSpan.textContent = finalPrice.toFixed(2);
                resultsDiv.classList.remove('hidden');
                resultsDiv.classList.add('show');
                errorMessageDiv.style.display = 'none';
        
            } catch (error) {
                // 13. Обробити помилки
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
            console.log("ZIP code received in getCoordinatesFromZip:", zipCode); // Логування ZIP коду
            const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&postalcode=${zipCode}&countrycodes=US`;
        
            try {
                const response = await fetch(nominatimUrl);
                console.log("Nominatim Response:", response); // Логування відповіді від Nominatim
                if (!response.ok) {
                    throw new Error('Nominatim API error');
                }
                const data = await response.json();
                console.log("Nominatim Data:", data); // Логування даних від Nominatim
        
                if (data && data.length > 0) {
                    const lon = parseFloat(data[0].lon); // Довгота
                    const lat = parseFloat(data[0].lat); // Широта
                    console.log("Coordinates from ZIP:", [lon, lat]); // Логування координат
                    return [lon, lat]; // OpenRouteService очікує [довгота, широта]
                } else {
                    throw new Error('Invalid ZIP code');
                }
            } catch (error) {
                console.error('Error fetching coordinates from Nominatim:', error);
                throw new Error('Error fetching coordinates from ZIP');
            }
        }
        
        // Функція для отримання координат з назви міста (використовує Nominatim API)
        async function getCoordinatesFromCity(cityName) {
            console.log("City name received in getCoordinatesFromCity:", cityName); // Логування назви міста
            const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${cityName}&countrycodes=US`;
        
            try {
                const response = await fetch(nominatimUrl);
                console.log("Nominatim Response:", response); // Логування відповіді від Nominatim
                if (!response.ok) {
                    throw new Error('Nominatim API error');
                }
                const data = await response.json();
                console.log("Nominatim Data:", data); // Логування даних від Nominatim
        
                if (data && data.length > 0) {
                    const lon = parseFloat(data[0].lon); // Довгота
                    const lat = parseFloat(data[0].lat); // Широта
                    console.log("Coordinates from city:", [lon, lat]); // Логування координат
                    return [lon, lat];
                } else {
                    throw new Error('Invalid city name');
                }
            } catch (error) {
                console.error('Error fetching coordinates from Nominatim:', error);
                throw new Error('Error fetching coordinates from city');
            }
        }
