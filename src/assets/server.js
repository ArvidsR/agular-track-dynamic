const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); 

const app = express();
const PORT = 3000;

app.use(cors()); 

// PostgreSQL pieslēgšanās parametri
const dbParams = {
  user: 'postgres',
  host: 'localhost',
  database: 'Track cycling',
  password: '12345',
  port: 5432,
};

const pool = new Pool(dbParams);
app.use(express.json());

// 1. Iegūst visus pieejamos heat (vai kā tos dēvē jūsu datu modelī)
app.get('/api/heat', async (req, res) => {
  try {
    const query = 'SELECT DISTINCT heat_id FROM tracking.rider';  // Pielāgojiet šo vaicājumu pēc vajadzības
    const result = await pool.query(query);
    res.json(result.rows);  // Atgriežam visus pieejamos heat
  } catch (err) {
    console.error('Error fetching heat:', err);
    res.status(500).send('Error fetching heat');
  }
});

// 2. Iegūst visus pieejamos rider, pamatojoties uz heat
app.get('/api/riders/:heat', async (req, res) => {
  const { heat } = req.params;
  try {
    // SQL vaicājums ar AS, lai pārsauktu "number" uz "riderID"
    const query = `
      SELECT DISTINCT number AS "riderID", name 
      FROM tracking.rider 
      WHERE heat_id = $1
    `;
    const result = await pool.query(query, [heat]);

    // Rezultāts tiek tieši atgriezts, jo "riderID" jau ir no SQL
    res.json(result.rows); 
  } catch (err) {
    console.error('Error fetching riders:', err);
    res.status(500).send('Error fetching riders');
  }
});

// 3. Iegūst visus pieejamos laps, pamatojoties uz heat un rider
app.get('/api/laps/:heat/:rider', async (req, res) => {
  const { heat, rider } = req.params;

  try {
    // Iegūstam konkrētā braucēja datus no datubāzes, sakārtotus pēc secības
    const query = 'SELECT s FROM tracking.rider WHERE heat_id = $1 AND number = $2';
    const result = await pool.query(query, [heat, rider]);

    const rows = result.rows; // Šie ir visi dati par `s` vērtībām

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No data found for this rider and heat.' });
    }

    // Aprēķinām apļus
    let currentLap = 0;
    let previousS = rows[0].s; // Sākuma `s` vērtība
    const laps = new Set();  // Izmanto Set, lai saglabātu tikai unikālos apļus

    rows.forEach(row => {
      const currentS = row.s;

      // Ja `s` vērtība pāriet pāri robežai no 245 uz 0, tas nozīmē jaunu apli
      if (previousS > 245 && currentS < 5) {
        currentLap++;
      }

      // Pievienojam pašreizējo apļa numuru tikai tad, ja tas ir unikāls
      laps.add(currentLap);

      previousS = currentS; // Atjaunojam iepriekšējo `s` vērtību
    });

    // Atgriežam unikālos apļus kā masīvu
    res.json(Array.from(laps));
  } catch (err) {
    console.error('Error calculating laps:', err);
    res.status(500).send('Error calculating laps');
  }
});

// 4. Iegūst datus scatter plotam, pamatojoties uz izvēlēto heat, rider un lap
app.get('/api/scatter-data/:heat/:rider/:lap', async (req, res) => {
  const { heat, rider, lap } = req.params;

  try {
    // SQL vaicājums, lai iegūtu visus datus konkrētajam heat un braucējam
    const query = `
      SELECT name, time, x, y, real_speed, s, d 
      FROM tracking.rider
      WHERE heat_id = $1 AND number = $2
    `;
    const result = await pool.query(query, [heat, rider]);
    const data = result.rows;

    // Aprēķina apļus un iegūst tikai datus vēlamajam aplim
    const scatterData = processLapData(data, parseInt(lap, 10));

    res.json(scatterData);
  } catch (err) {
    console.error('Error fetching scatter data:', err);
    res.status(500).send('Error fetching scatter data');
  }
});

// Palīgfunkcija apļiem
function processLapData(data, targetLap) {
  const allData = [];
  let currentLap = 0; // Apļu skaitīšanu sākam ar 0
  let previousS = data[0]?.s || 0; // Lai izvairītos no kļūdām, ja datu masīvs ir tukšs

  // Iet cauri katrai datu rindai
  data.forEach((row, index) => {
    const currentS = row.s;

    // Ja mainās no lielas `s` uz mazu (robeža), palielina apļa skaitītāju
    if (index > 0 && previousS > 245 && currentS < 5) {
      currentLap += 1; // Palielina apļa skaitītāju
    }

    // Ja pašreizējais ieraksts atbilst mērķa aplim, pievieno to rezultātam
    if (currentLap === targetLap) {
      allData.push({
        ...row,
        lap: currentLap, // Pievienojam apļa skaitli
      });
    }

    previousS = currentS; // Saglabā iepriekšējo `s` vērtību nākamajai iterācijai
  });

  return allData;
}

// Startē serveri
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});