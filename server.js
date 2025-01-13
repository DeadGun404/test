const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname)));



// Настройка сессий
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }  // Установите secure: true для HTTPS
}));

// Настройка парсинга данных
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Настройка статических файлов
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Подключение базы данных SQLite
const db = new sqlite3.Database('./pets.db');

// Создание таблицы пользователей, если её нет
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )
    `);
});

// Создание таблицы питомцев, если её нет
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS pets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            petName TEXT NOT NULL,
            petAge INTEGER NOT NULL,
            petType TEXT NOT NULL,
            FOREIGN KEY(userId) REFERENCES users(id)
        )
    `);
});

// Маршрут для страницы логина
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Маршрут для страницы регистрации
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

// Маршрут для обработки регистрации
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    // Проверка наличия данных
    if (!username || !password) {
        return res.status(400).send('Имя пользователя и пароль обязательны.');
    }

    // Хеширование пароля
    const saltRounds = 10;

    bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
        if (err) {
            return res.status(500).send('Ошибка хеширования пароля.');
        }

        // Сохранение пользователя в базу
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function (err) {
            if (err) {
                console.error('Ошибка регистрации:', err.message);
                return res.status(500).send('Ошибка регистрации');
            }
            req.session.userId = this.lastID;  // Сохраняем ID пользователя в сессии
            res.redirect('/dashboard');
        });
    });
});

// Маршрут для обработки логина
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Проверка наличия данных
    if (!username || !password) {
        return res.status(400).send('Имя пользователя и пароль обязательны.');
    }

    // Поиск пользователя в базе данных
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Ошибка при поиске пользователя:', err.message);
            return res.status(500).send('Ошибка при поиске пользователя');
        }

        if (!user) {
            return res.status(404).send('Пользователь не найден');
        }

         // Сравнение пароля с хешированным
        bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
                console.error('Ошибка при сравнении паролей:', err.message);
                return res.status(500).send('Ошибка при сравнении паролей');
            }

            if (result) {
                req.session.userId = user.id;  // Сохраняем ID пользователя в сессии
                res.redirect('/dashboard');
            } else {
                res.status(401).send('Неверный пароль');
            }
        });
    });
});

// Маршрут для страницы личного кабинета
app.get('/dashboard', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/');
    }

    // Получаем список питомцев пользователя
    db.all('SELECT * FROM pets WHERE userId = ?', [req.session.userId], (err, pets) => {
        if (err) {
            console.error('Ошибка при получении питомцев:', err.message);
            return res.status(500).send('Ошибка при получении питомцев');
        }

        res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    });
});

// Маршрут для добавления питомца
app.post('/addPet', (req, res) => {
    const { petName, petAge, petType } = req.body;

    if (!petName || !petAge || !petType) {
        return res.status(400).send('Все поля обязательны');
    }

    db.run('INSERT INTO pets (userId, petName, petAge, petType) VALUES (?, ?, ?, ?)', [req.session.userId, petName, petAge, petType], function (err) {
        if (err) {
            console.error('Ошибка добавления питомца:', err.message);
            return res.status(500).send('Ошибка добавления питомца');
        }

        res.json({ success: true, petId: this.lastID });
    });
});

// Маршрут для выхода из аккаунта
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Ошибка при выходе:', err.message);
            return res.status(500).json({ success: false, message: 'Ошибка при выходе' });
        }

        // Логируем, что сессия завершена
        console.log('Сессия завершена');
        
        // Отправляем правильный JSON-ответ
        res.json({ success: true });
    });
});

app.get('/getPets', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Пользователь не авторизован' });
    }

    // Получаем список питомцев пользователя
    db.all('SELECT * FROM pets WHERE userId = ?', [req.session.userId], (err, pets) => {
        if (err) {
            console.error('Ошибка при получении питомцев:', err.message);
            return res.status(500).json({ message: 'Ошибка при получении питомцев' });
        }

        res.json({ pets: pets });
    });
});


// Запуск сервера
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

app.post('/editPet', (req, res) => {
    const { petId, petName, petAge, petType } = req.body;

    if (!petId || !petName || !petAge || !petType) {
        return res.status(400).send('Все поля обязательны для редактирования.');
    }

    db.run(
        'UPDATE pets SET petName = ?, petAge = ?, petType = ? WHERE id = ? AND userId = ?',
        [petName, petAge, petType, petId, req.session.userId],
        function (err) {
            if (err) {
                console.error('Ошибка при редактировании питомца:', err.message);
                return res.status(500).send('Ошибка при редактировании питомца.');
            }

            res.json({ success: true, message: 'Питомец успешно обновлен.' });
        }
    );
});

app.post('/deletePet', (req, res) => {
    const { petId } = req.body;

    if (!petId) {
        return res.status(400).send('ID питомца обязателен для удаления.');
    }

    db.run(
        'DELETE FROM pets WHERE id = ? AND userId = ?',
        [petId, req.session.userId],
        function (err) {
            if (err) {
                console.error('Ошибка при удалении питомца:', err.message);
                return res.status(500).send('Ошибка при удалении питомца.');
            }

            res.json({ success: true, message: 'Питомец успешно удален.' });
        }
    );
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            petId INTEGER NOT NULL,
            eventName TEXT NOT NULL,
            eventTime TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            FOREIGN KEY(petId) REFERENCES pets(id)
        )
    `);
    db.run('CREATE INDEX IF NOT EXISTS idx_petId ON events (petId)');
});

// Получение событий для конкретного питомца
app.get('/pets/:petId/events', (req, res) => {
    const petId = parseInt(req.params.petId, 10);
    if (isNaN(petId)) {
        return res.status(400).send('Некорректный идентификатор питомца');
    }

    db.all(
        `SELECT events.id, events.eventName, events.eventTime, events.completed, pets.petName 
         FROM events 
         JOIN pets ON events.petId = pets.id 
         WHERE events.petId = ?`,
        [petId],
        (err, events) => {
            if (err) {
                console.error('Ошибка получения событий:', err.message);
                return res.status(500).send('Ошибка получения событий');
            }

            res.json(events);
        }
    );
});

// Добавление события
app.post('/pets/:petId/events', (req, res) => {
    const petId = parseInt(req.params.petId, 10);
    const { eventName, eventTime } = req.body;

    // Проверка данных
    const timeRegex = /^\d{2}:\d{2}$/; // Формат HH:MM
    if (isNaN(petId) || !eventName || !eventTime || !timeRegex.test(eventTime)) {
        return res.status(400).json({ error: 'Некорректные данные' });
    }

    // Проверка наличия питомца
    db.get('SELECT id FROM pets WHERE id = ?', [petId], (err, row) => {
        if (err) {
            console.error('Ошибка проверки питомца:', err.message);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Питомец не найден' });
        }

        // Добавление события
        db.run(
            'INSERT INTO events (petId, eventName, eventTime) VALUES (?, ?, ?)',
            [petId, eventName, eventTime],
            function (err) {
                if (err) {
                    console.error('Ошибка добавления события:', err.message);
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }

                res.json({ success: true, eventId: this.lastID });
            }
        );
    });
});

// Обновление статуса события
app.put('/events/:eventId', (req, res) => {
    const eventId = parseInt(req.params.eventId, 10);
    const { completed } = req.body;

    if (isNaN(eventId)) {
        return res.status(400).json({ error: 'Некорректный идентификатор события' });
    }

    // Преобразование completed в boolean
    const isCompleted = completed === true || completed === 'true';

    db.run(
        'UPDATE events SET completed = ? WHERE id = ?',
        [isCompleted ? 1 : 0, eventId],
        function (err) {
            if (err) {
                console.error('Ошибка обновления события:', err.message);
                return res.status(500).json({ error: 'Ошибка обновления события' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Событие не найдено' });
            }

            res.json({ success: true });
        }
    );
});

// Пример маршрута для получения питомцев
app.get('/getPets', (req, res) => {
    db.all('SELECT * FROM pets', (err, pets) => {
        if (err) {
            return res.status(500).send('Ошибка при получении питомцев');
        }
        res.json({ pets });
    });
});

// Пример маршрута для получения событий
app.get('/getEventsWithPets', (req, res) => {
    db.all(`
        SELECT events.id, events.eventName, events.eventTime, events.completed, pets.petName
        FROM events
        JOIN pets ON events.petId = pets.id
    `, (err, events) => {
        if (err) {
            return res.status(500).send('Ошибка при получении событий');
        }
        res.json({ events });
    });
});

// Пример маршрута для добавления события
app.post('/addEvent', (req, res) => {
    const { petId, eventName, eventTime } = req.body;
    db.run(
        'INSERT INTO events (petId, eventName, eventTime) VALUES (?, ?, ?)',
        [petId, eventName, eventTime],
        function (err) {
            if (err) {
                return res.status(500).send('Ошибка при добавлении события');
            }
            res.json({ success: true, eventId: this.lastID });
        }
    );
});

app.post('/deleteEvent', (req, res) => {
    const { eventId } = req.body;
    
    // Код для удаления события из базы данных (например, SQLite)
    const query = 'DELETE FROM events WHERE id = ?';
    db.run(query, [eventId], function(err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Ошибка при удалении события' });
        }
        res.json({ success: true, message: 'Событие удалено' });
    });
});

const webPush = require('web-push');


// Генерация ключей для VAPID (если их ещё нет)
webPush.setVapidDetails(
    'mailto:example@yourdomain.org',
    'BI9OLeawXzIFG3f3floXneMwgDdhN9XZJMQywiEsnDgWaR78DxblY_Q4IFpM10rvdVs55DNtAYqb6lvC9F5BME0', // Публичный ключ
    'r_IwszusZgO-mQeTH5x255X2I88xbLsueTvVLFYzGLw' // Приватный ключ
);

app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    // Сохраните подписку в базе данных или файле
    res.status(201).json({});
});

app.post('/sendNotification', (req, res) => {
    const subscription = req.body.subscription;
    const payload = JSON.stringify({
        title: 'Напоминание!',
        body: 'Не забудьте о событии!'
    });

    webPush.sendNotification(subscription, payload)
        .then(response => res.status(200).json({ success: true }))
        .catch(error => {
            console.error('Ошибка отправки уведомления:', error);
            res.status(500).json({ success: false });
        });
});
    






// Ваша база данных событий
const events = [
    { id: 1, eventName: 'Кормление', eventTime: '14:00', petName: 'Барсик' },
    { id: 2, eventName: 'Прогулка', eventTime: '16:00', petName: 'Мурка' }
];

// Настроим веб-пуш
webPush.setVapidDetails(
    'mailto:example@yourdomain.org',
    'BI9OLeawXzIFG3f3floXneMwgDdhN9XZJMQywiEsnDgWaR78DxblY_Q4IFpM10rvdVs55DNtAYqb6lvC9F5BME0',  // Публичный ключ
    'r_IwszusZgO-mQeTH5x255X2I88xbLsueTvVLFYzGLw'  // Приватный ключ
);

// Пример маршрута для подписки
app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    // Сохраните подписку в базе данных
    res.status(201).json({});
});

// Пример маршрута для отправки уведомлений в заданное время
app.post('/sendNotification', (req, res) => {
    const { subscription, event } = req.body;  // Содержит подписку пользователя и событие

    const payload = JSON.stringify({
        title: `Время для события: ${event.eventName}`,
        body: `Не забудьте про событие для ${event.petName}!`
    });

    webPush.sendNotification(subscription, payload)
        .then(() => res.status(200).json({ success: true }))
        .catch(err => {
            console.error('Ошибка при отправке уведомления:', err);
            res.status(500).json({ success: false });
        });
});

const cron = require('node-cron');

// Настройка cron задачи для проверки и отправки уведомлений
cron.schedule('* * * * *', () => {
    const currentTime = new Date();
    events.forEach(event => {
        const eventTime = new Date(`${currentTime.toDateString()} ${event.eventTime}`);
        if (eventTime <= currentTime && !event.notified) {
            // Отправляем уведомление
            sendNotificationToUser(event);
            event.notified = true; // Уведомление отправлено
        }
    });
});

function sendNotificationToUser(event) {
    // Отправка пуш-уведомлений через веб-пуш
    // Найти подписку для этого события и отправить уведомление
}





    db.serialize(() => {
        // Создаем таблицу для медицинских карт
        db.run(`
            CREATE TABLE IF NOT EXISTS medical_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                petId INTEGER NOT NULL,
                diagnosis TEXT,
                vaccinations TEXT,
                recommendations TEXT,
                lastVisitDate TEXT,
                nextVisitDate TEXT,
                FOREIGN KEY(petId) REFERENCES pets(id)
            )
        `);
    });

    

    // Получение медицинских карт питомца
// Получение медицинских данных для питомца
app.get('/pets/:petId/medical-record', (req, res) => {
    const petId = parseInt(req.params.petId, 10);

    if (isNaN(petId)) {
        return res.status(400).json({ error: 'Некорректный идентификатор питомца' });
    }

    db.get('SELECT * FROM medical_records WHERE petId = ?', [petId], (err, row) => {
        if (err) {
            console.error('Ошибка при получении данных:', err.message);
            return res.status(500).json({ error: 'Ошибка при получении данных' });
        }

        if (row) {
            res.json(row);  // Отправляем сохраненные медицинские данные
        } else {
            res.status(404).json({ error: 'Медицинские данные не найдены' });
        }
    });
});




// Добавление или обновление медицинской карты
app.post('/pets/:petId/medical-record', (req, res) => {
    const petId = parseInt(req.params.petId, 10);
    const { diagnosis, vaccinations, recommendations, lastVisitDate, nextVisitDate } = req.body;

    // Проверка данных
    if (isNaN(petId) || !diagnosis || !vaccinations || !recommendations || !lastVisitDate || !nextVisitDate) {
        return res.status(400).json({ error: 'Некорректные данные' });
    }

    // Проверка наличия питомца
    db.get('SELECT id FROM pets WHERE id = ?', [petId], (err, row) => {
        if (err) {
            console.error('Ошибка проверки питомца:', err.message);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Питомец не найден' });
        }

        // Проверяем, есть ли уже запись медицинской карты для этого питомца
        db.get('SELECT id FROM medical_records WHERE petId = ?', [petId], (err, row) => {
            if (err) {
                console.error('Ошибка проверки медицинской карты:', err.message);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (row) {
                // Обновление существующей медицинской карты
                db.run(
                    'UPDATE medical_records SET diagnosis = ?, vaccinations = ?, recommendations = ?, lastVisitDate = ?, nextVisitDate = ? WHERE petId = ?',
                    [diagnosis, vaccinations, recommendations, lastVisitDate, nextVisitDate, petId],
                    function (err) {
                        if (err) {
                            console.error('Ошибка обновления медицинской карты:', err.message);
                            return res.status(500).json({ error: 'Ошибка сервера' });
                        }
                        res.json({ success: true });
                    }
                );
            } else {
                // Добавление новой медицинской карты
                db.run(
                    'INSERT INTO medical_records (petId, diagnosis, vaccinations, recommendations, lastVisitDate, nextVisitDate) VALUES (?, ?, ?, ?, ?, ?)',
                    [petId, diagnosis, vaccinations, recommendations, lastVisitDate, nextVisitDate],
                    function (err) {
                        if (err) {
                            console.error('Ошибка добавления медицинской карты:', err.message);
                            return res.status(500).json({ error: 'Ошибка сервера' });
                        }
                        res.json({ success: true, recordId: this.lastID });
                    }
                );
            }
        });
    });
});

app.get('/getPets', (req, res) => {
    db.all('SELECT * FROM pets', (err, pets) => {
        if (err) {
            return res.status(500).send('Ошибка при получении питомцев');
        }
        res.json({ pets });
    });
});

app.post('/delete-medical-records-table', (req, res) => {
    const query = `DROP TABLE IF EXISTS medical_records`;  // Команда для удаления таблицы

    db.run(query, function(err) {
        if (err) {
            console.error('Ошибка при удалении таблицы medical_records:', err.message);
            return res.status(500).json({ error: 'Ошибка при удалении таблицы medical_records' });
        }
        res.json({ message: 'Таблица medical_records успешно удалена' });
    });
});
