const express = require('express'); // Izveido servera lietojumprogrammu
const cors = require('cors'); // Ļauj piekļūt serverim no citām vietnēm
const { Pool } = require('pg'); // Savienojums ar PostgreSQL datubāzi

const app = express();
const PORT = 3000;

app.use(cors()); // Atļauj datiem piekļūt no citām lietotnēm
app.use(express.json()); // Nodrošina, ka serveris saprot JSON formāta pieprasījumus

// Datu bāzes savienojuma parametri
const dbParams = {
  user: 'postgres',
  host: 'localhost',
  database: 'Track cycling',
  password: '12345',
  port: 5432,
};

const pool = new Pool(dbParams);

// Atbild uz pieprasījumu iegūt visus pieejamos braucienus (heat)
app.get('/api/heat', async (req, res) => {
  try {
    const query = 'SELECT DISTINCT heat_id FROM tracking.rider';
    const result = await pool.query(query);
    res.json(result.rows); // Atgriež braucienu sarakstu
  } catch (err) {
    console.error('Kļūda, iegūstot braucienus:', err);
    res.status(500).send('Kļūda, iegūstot braucienus');
  }
});

// Atbild uz pieprasījumu iegūt konkrētā brauciena dalībniekus (rider)
app.get('/api/riders/:heat', async (req, res) => {
  const { heat } = req.params; // Saņem izvēlēto braucienu no pieprasījuma
  try {
    const query = 'SELECT DISTINCT number AS "riderID", name FROM tracking.rider WHERE heat_id = $1';
    const result = await pool.query(query, [heat]);
    res.json(result.rows); // Atgriež braucēju sarakstu
  } catch (err) {
    console.error('Kļūda, iegūstot braucējus:', err);
    res.status(500).send('Kļūda, iegūstot braucējus');
  }
});

app.get('/api/laps/:heat/:rider', async (req, res) => {
  const { heat, rider } = req.params; // Saņem izvēlēto braucienu un braucēju
  try {
    const query = 'SELECT s FROM tracking.rider WHERE heat_id = $1 AND number = $2 ORDER BY time ASC';
    const result = await pool.query(query, [heat, rider]);
    const rows = result.rows;

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Dati netika atrasti' });
    }

    let currentLap = 0;
    let previousS = rows[0].s;
    const laps = new Set();

    rows.forEach(row => {
      const currentS = row.s;
      if (previousS > 245 && currentS < 5) {
        currentLap++;
      }
      laps.add(currentLap);
      previousS = currentS;
    });

    // Atrodi pēdējo apli
    const lastLap = Math.max(...laps);

    res.json({
      laps: Array.from(laps), // Atgriež apļu sarakstu
      lastLap // Atgriež pēdējo apli
    });
  } catch (err) {
    console.error('Kļūda, aprēķinot apļus:', err);
    res.status(500).send('Kļūda, aprēķinot apļus');
  }
});



// Atbild uz pieprasījumu iegūt scatter plot datus
app.get('/api/scatter-data/:heat/:rider/:lap', async (req, res) => {
  const { heat, rider, lap } = req.params; // Saņem izvēlēto braucienu, braucēju un apli
  try {
    const query = `
    SELECT name, time, x, y, real_speed, s, d 
    FROM tracking.rider 
    WHERE heat_id = $1 
    AND number = $2
    `;
    const result = await pool.query(query, [heat, rider]);
    const data = result.rows;

    const scatterData = processLapData(data, parseInt(lap, 10));
    res.json(scatterData); // Atgriež datus konkrētajam aplim
  } catch (err) {
    console.error('Kļūda, iegūstot scatter plot datus:', err);
    res.status(500).send('Kļūda, iegūstot scatter plot datus');
  }
});


// Funkcija, kas sagatavo datus konkrētajam aplim
function processLapData(data, targetLap) {
  const allData = [];
  let currentLap = 0;
  let previousS = data[0]?.s || 0;

  data.forEach((row, index) => {
    const currentS = row.s;
    if (index > 0 && previousS > 245 && currentS < 5) {
      currentLap++;
    }
    if (currentLap === targetLap) {
      allData.push({ ...row, lap: currentLap });
    }
    previousS = currentS;
  });

  return allData; // Atgriež tikai mērķa apļa datus
}

// Startē serveri
app.listen(PORT, () => {
  console.log(`Serveris darbojas: http://localhost:${PORT}`);
});
