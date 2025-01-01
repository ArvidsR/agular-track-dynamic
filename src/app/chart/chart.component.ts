import { Component, OnInit, ViewChild } from '@angular/core'; // Komponentes pamatklase un inicializācijas saskarne
import { Chart, ChartConfiguration, ChartData, ChartType } from 'chart.js'; // Bibliotēka datu vizualizācijai
import { BaseChartDirective } from 'ng2-charts'; // Angular komponente darbam ar Chart.js
import { CommonModule } from '@angular/common'; // Angular modulis, kas nodrošina pamata funkcionalitāti (piem., *ngIf, *ngFor)
import { FormsModule } from '@angular/forms'; // Angular modulis darbam ar formām un datu ievadi
import { firstValueFrom } from 'rxjs'; // RxJS rīks, lai pārvērstu Observable par Promise
import { backgroundImagePlugin } from '../plugins/backgroundImagePlugin'; // Pielāgots Chart.js spraudnis, lai pievienotu treka bildi kā fonu diagrammai
import { HttpClientModule } from '@angular/common/http'; // Modulis darbam ar HTTP pieprasījumiem
import { ApiService } from '../api.service'; // Pielāgota servisa klase darbam ar API

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.css'],
  standalone: true,
  imports: [BaseChartDirective, CommonModule, FormsModule, HttpClientModule]
})
export class ChartComponent implements OnInit {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective; // Nodrošina piekļuvi chart.js instancei komponentē

  // Izkliedes diagrammas(scatter plot) konfigurācija
  public scatterChartOptions: ChartConfiguration['options'] = {
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        display: false,
        suggestedMin: -60, 
        suggestedMax: 60
      },
      y: {
        display: false,
        suggestedMin: -30,
        suggestedMax: 30
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false
      }
    },
    animation: {
      duration: 0
    }
  };
  public scatterChartData: ChartData<'scatter'> = {
    datasets: []
  };
  public scatterChartType: ChartType = 'scatter';

  // Lietotāja interfeisa stāvoklis un izvēles dati
  public step: string = 'start'; // Pašreizējais solis
  public heats: any[] = []; // Pieejamie braucieni no API
  public selectedHeats: Set<number> = new Set(); // Lietotāja izvēlētie braucieni
  public riders: any[] = []; // Pieejamie braucēji
  public selectedRiders: Set<number> = new Set(); // Lietotāja izvēlētie braucēji
  public laps: any[] = []; // Pieejamie apļi
  public selectedLaps: Set<number> = new Set(); // Lietotāja izvēlētie apļi

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    Chart.register(backgroundImagePlugin); // Reģistrē fona spraudni(plug-in)
    this.updateChart();
    this.step = 'start'; // Sākuma solis
  }

  // Saņem pieejamos heat no API
  getHeats(): void {
    this.apiService.getHeats().subscribe((data) => {
      this.heats = data;
      this.step = 'heat'; // Pāriet uz nākamo soli
    });
  }

  // Atiestata braucēju un apļu izvēli, mainot heat
  resetSelectionsOnHeatChange(): void {
    this.selectedRiders.clear(); // Notīra visus braucējus
    this.selectedLaps.clear();   // Notīra visus apļus
    this.riders = [];            // Notīra braucēju datus
    this.laps = [];              // Notīra apļu datus
  }

  public selectedHeat: number | null = null; // Vienīgais atzīmētais Heat

  // Atzīmē vai noņem izvēlēto Heat
  selectSingleHeat(heatId: number): void {
    if (this.selectedHeat === heatId) {
      this.selectedHeat = null; // Noņem atzīmi, ja to pašu atzīmē vēlreiz
      this.resetSelectionsOnHeatChange();
    } else {
      this.selectedHeat = heatId; // Iestata jauno Heat kā izvēlēto
      this.resetSelectionsOnHeatChange();
    }
  }

  // Pāriet uz braucēju izvēli
  proceedToRiders(): void {
    if (this.selectedHeat !== null) {
      this.apiService.getRiders(this.selectedHeat.toString()).subscribe((data) => {
        this.riders = data.map((rider: any) => ({
          riderID: rider.riderID, // API atgriež riderID
          name: rider.name
        }));
        this.step = 'rider';
      });
    }
  }
  
  // Pievieno vai noņem braucēju
  toggleRiderSelection(riderId: number, name: string): void {
    if (this.selectedRiders.has(riderId)) {
      // Ja braucējs jau ir izvēlēts, noņem to no izvēlēto saraksta un notīra trackerData
      this.selectedRiders.delete(riderId);
      delete this.trackerData[riderId]; // Dzēš datus par braucēju
    } else {
      // Ja braucējs nav izvēlēts, pievieno to izvēlēto sarakstam un saglabā sākotnējos datus
      this.selectedRiders.add(riderId);
      this.trackerData[riderId] = {
        name: name, // Saglabā braucēja vārdu
        speed: 0,        // Sākotnējais ātrums
        s: 0,            // Sākotnējā s vērtība
        d: 0,            // Sākotnējā d vērtība
        isActive: false  // Sākotnēji neaktīvs
      };
    }
  }
  
  public lastLapMap: Map<number, number> = new Map<number, number>();
  // Pāriet uz apļu izvēli
  proceedToLaps(): void {
    const selectedHeat = this.selectedHeat; // Vienīgais Heat
    const selectedRidersArray = Array.from(this.selectedRiders);
  
    const lapRequests = selectedRidersArray.map((rider) =>
      this.apiService.getLaps(selectedHeat!.toString(), rider.toString())
    );
  
    Promise.all(lapRequests.map((req) => req.toPromise())).then((responses) => {
      const allLaps: number[] = [];
      const lastLapMap = new Map<number, number>(); // Pēdējā apļa karte braucējiem
  
      responses.forEach((response, index) => {
        const riderId = selectedRidersArray[index];
        allLaps.push(...response.laps); // Apvieno visus apļus
        lastLapMap.set(riderId, response.lastLap); // Saglabā pēdējo apli konkrētajam braucējam
      });
  
      this.laps = Array.from(new Set(allLaps)).sort((a, b) => a - b); // Apvieno un sakārto apļus augošā secībā
      this.lastLapMap = lastLapMap; // Saglabā pēdējo apļu karti
      console.log(lastLapMap);
      this.step = 'lap';
    }).catch((error) => {
      console.error('Error fetching laps:', error);
    });
  }
  

  // Pievieno vai noņem apli
  toggleLapSelection(lapId: number): void {
    this.selectedLaps.has(lapId) 
      ? this.selectedLaps.delete(lapId) // Ja aplis jau ir izvēlēts, noņem to no izvēlēto saraksta
      : this.selectedLaps.add(lapId);  // Ja aplis nav izvēlēts, pievieno to izvēlēto sarakstam
  }

  // Atgriežas iepriekšējā solī
  goBack(): void {
    const stepOrder = ['start', 'heat', 'rider', 'lap', 'chart'];
    const currentIndex = stepOrder.indexOf(this.step);
  
    if (currentIndex > 0) {
      this.step = stepOrder[currentIndex - 1];
  
      if (this.step === 'heat') {
        this.resetSelectionsOnHeatChange(); // Atiestata visus braucējus un apļus
      } else if (this.step === 'rider') {
        this.selectedLaps.clear(); // Atiestata tikai apļus, ja iet atpakaļ uz braucējiem
      }
    }
  }

  // Krāsu piešķiršana braucējiem
  private pointColors: string[] = [
    'red', 'orange', 'cyan', 'purple', 'yellow', 'pink',
    'lightgreen', 'black', 'gray', 'green', 'gold', 'blue'
  ];
  
  private riderColorMap: Map<number, string> = new Map();

  public getColorForRider(riderId: number): string {
    if (!this.riderColorMap.has(riderId)) {
      const colorIndex = this.riderColorMap.size % this.pointColors.length; // Aprēķina krāsas indeksu, lai atkārtotu krāsas, ja to nepietiek
      this.riderColorMap.set(riderId, this.pointColors[colorIndex]);
    }
    return this.riderColorMap.get(riderId)!;
  }

  private filteredData: { [riderId: number]: any[] } = {}; // Saglabā datus katram braucējam

  // Izkliedes diagrammas funkcija, kas parāda uzreiz visu trajektoriju braucējam
  updateChart(): void {
    if (!this.selectedHeat) {
      console.error('No heat selected!');
      return; // Ja nav izvēlēts heat, pārtrauc funkciju
    }
  
    if (this.selectedRiders.size === 0 || this.selectedLaps.size === 0) {
      console.error('No riders or laps selected!');
      return; // Ja nav izvēlēti braucēji vai apļi, pārtrauc funkciju
    }
  
    // Veido pieprasījumus API, lai iegūtu izkliedes diagrammas datus
    const scatterRequests = Array.from(this.selectedRiders).flatMap((rider) =>
      Array.from(this.selectedLaps).map((lap) =>
        this.apiService.getScatterData(this.selectedHeat!.toString(), rider.toString(), lap.toString())
      )
    );
  
    // Apstrādā API pieprasījumus
    // `Promise.all` tiek izmantots, lai izpildītu visus pieprasījumus paralēli, un kad tie ir pabeigti, rezultāti tiek apvienoti
    // `firstValueFrom` konvertē katru pieprasījumu no RxJS Observable uz parastu JavaScript Promise
    Promise.all(scatterRequests.map((req) => firstValueFrom(req))).then((responses) => {
      const datasets: ChartData<'scatter'>['datasets'] = [];
      let responseIndex = 0;
  
      this.filteredData = {}; // Reset before populating
  
      Array.from(this.selectedRiders).forEach((riderId) => {
        this.filteredData[riderId] = [];
  
        Array.from(this.selectedLaps).forEach((lap) => {
          const riderLapData: any[] = responses[responseIndex++] || [];
  
          if (riderLapData.length > 0) {
            this.filteredData[riderId].push(
              ...riderLapData.map((item: any) => ({ ...item, lap }))
            );
  
            const pathData = riderLapData
              .filter((_: any, idx: number) => idx % 12 === 0)
              .map((item: any) => ({ x: item.x, y: item.y }));
  
            datasets.push({
              label: `Rider ${riderId} - Lap ${lap}`,
              data: pathData,
              backgroundColor: this.getColorForRider(riderId),
              pointRadius: 3,
            });
          } else {
            console.warn(`No data for Rider ${riderId}, Lap ${lap}`);
          }
        });
      });
  
      this.scatterChartData = { datasets };
      if (this.chart?.chart) {
        this.chart.chart.destroy();
      }
  
      this.updateMinMaxTime();
      this.step = 'chart';
    }).catch((error) => {
      console.error('Error generating scatter chart:', error);
    });
  }
  

  public selectedTimeIndex: number = 0; // Pašreizējā laika pozīcija laika slīdņa indeksā
  public maxTimeIndex: number = 0; // Maksimālais pieejamais laika indekss
  public startTime: string = ''; // Diagrammas datu minimālā sākuma laika formatēta vērtība
  public currentTime: string = ''; // Pašreizējais formatētais laiks, kas tiek parādīts lietotājam
  public endTime: string = ''; // Diagrammas datu maksimālā beigu laika formatēta vērtība
  public minTime: Date = new Date();
  public maxTime: Date = new Date();
  
  onTimeChange(event: any): void {
    const sliderValue = event.target.value; // Iegūst vērtību no laika slīdņa
    this.selectedTimeIndex = +sliderValue; // Atjauno pašreizējo laika indeksu
  
    // Aprēķina pašreizējo laiku milisekundēs un formatē to
    const currentTimeInMs = this.minTime.getTime() + this.selectedTimeIndex;
    this.currentTime = this.formatTime(new Date(currentTimeInMs));

    this.updateCurrentTimeDisplay(); 
    this.updateHighlightedPoints();
  }

  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0'); // Iegūst stundas no datuma objekta un pārvērš tās tekstā ar nulles pievienošanu, ja skaitlis ir mazāks par 10
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`; // Atgriež formatētu laiku tekstā kā "hh:mm:ss.mmm"
  }
  
  private updateMinMaxTime(): void {
    let minTime = Infinity;
    let maxTime = -Infinity;
  
    // Iterē caur visiem izvēlētajiem braucējiem un apļiem
    for (const rider of this.selectedRiders) {
      for (const lap of this.selectedLaps) {
        // Filtrē datus konkrētajam braucējam un aplim
        const lapData = this.filteredData[rider]?.filter((item) => item?.lap === lap);
        if (lapData && lapData.length > 0) { // Pārbauda, vai ir pieejami dati
          const startTime = new Date(lapData[0].time).getTime(); // Iegūst apļa sākuma laiku milisekundēs
          const endTime = new Date(lapData[lapData.length - 1].time).getTime();
  
          minTime = Math.min(minTime, startTime); // Atjauninām minimālo laiku, ja atrasts mazāks
          maxTime = Math.max(maxTime, endTime);
        }
      }
    }
  
    if (minTime === Infinity || maxTime === -Infinity) { // Ja minTime vai maxTime nav atjaunināti, dati nav derīgi
      console.error('No valid time data found!');
      return;
    }
  
    this.minTime = new Date(minTime); // Iestatām mazāko atrasto laiku
    this.maxTime = new Date(maxTime);
    this.startTime = this.formatTime(this.minTime); // Formatējam un saglabā sākuma laiku
    this.endTime = this.formatTime(this.maxTime);
    this.maxTimeIndex = maxTime - minTime; // Aprēķina kopējo laika intervālu
  }

  // Glabā braucēja ātrumu, s un d koordinātes, kā arī aktivitātes statusu
  public trackerData: {
    [riderId: number]: {
      name: string;
      speed: number;
      s: number;
      d: number;
      isActive: boolean;
    };
  } = {};
  
  //Izkliedes diagrammas funkcija, kas parāda kā braucējs kustās, lietotājam kustinot laika slīdni
  private updateHighlightedPoints(): void {
    const highlightedPoints: ChartData<'scatter'>['datasets'] = [];  // Glabā izceltos punktus diagrammai

    // Iterē cauri visiem izvēlētajiem braucējiem
    Array.from(this.selectedRiders).forEach((riderId) => {
      const combinedData: any[] = []; // Glabā visu apļu datus konkrētajam braucējam
  
      // Apvieno datus no visiem izvēlētajiem apļiem
      Array.from(this.selectedLaps).forEach((lap) => {
        const lapData = this.filteredData[riderId]?.filter((item) => item.lap === lap); // Filtrē datus konkrētajam aplim
        if (lapData) combinedData.push(...lapData); // Pievieno atrastos datus kombinētajam masīvam
      });
      
      // Sakārto kombinētos datus pēc laika pieauguma secības
      combinedData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  
      // Aprēķina minimālo un maksimālo laiku priekš konkrētā braucēja (Ja masīvs ir tukšs, laika vērtības tiek iestatītas uz 'null')
      const trackerMinTime = combinedData.length > 0 ? new Date(combinedData[0].time).getTime() : null;
      const trackerMaxTime = combinedData.length > 0 ? new Date(combinedData[combinedData.length - 1].time).getTime() : null;
  
      const relativeTime = this.minTime.getTime() + this.selectedTimeIndex; // Lietotāja izvēlētais laiks(uz laika slīdņa)
  
      // Pārbauda, vai lietotāja izvēlētais laiks atrodas braucēja laika intervālā
      if (trackerMinTime !== null && trackerMaxTime !== null && relativeTime >= trackerMinTime && relativeTime <= trackerMaxTime) {
        // Aprēķina tuvāko datu punktu konkrētajam laikam
        const closestIndex = this.getClosestIndexForTime(combinedData, relativeTime);
        const dataAtTime = combinedData[closestIndex];
  
        if (dataAtTime) {
          // Pievieno izcelto punktu diagrammai
          highlightedPoints.push({
            label: `Current Position - Rider ${riderId}`,
            data: [{ x: dataAtTime.x, y: dataAtTime.y }],
            backgroundColor: this.getColorForRider(riderId),
            pointRadius: 10 // Punktam piešķir lielāku izmēru, lai izceltos uz pārējo punktu fona
          });
  
          // Saglabā braucēja aktuālo informāciju
          this.trackerData[riderId] = {
            name: dataAtTime.name,
            speed: dataAtTime.real_speed * 3.6, // // Pārvērš ātrumu km/h
            s: dataAtTime.s, 
            d: dataAtTime.d, 
            isActive: true
          };
        }
      } else {
        // Ja lietotāja izvēlētais laiks nav intervālā, braucējs ir neaktīvs
        this.trackerData[riderId] = {
          ...this.trackerData[riderId],
          speed: 0,
          s: 0,
          d: 0,
          isActive: false
        };
      }
    });
  
    // Atjauno diagrammu, pievienojot izceltos punktus
    const datasets = [...this.scatterChartData.datasets];
    for (let i = datasets.length - 1; i >= 0; i--) {
        if (datasets[i].label?.startsWith('Current Position')) {
            datasets.splice(i, 1); // Izņem rindas ar "Current Position"
        }
    }
    this.scatterChartData = {
    datasets: [
        ...datasets, // Pievieno modificēto masīvu
        ...highlightedPoints // Pievieno jaunos izceltos punktus
    ]
    };
    this.chart?.update(); 
  }

  // Funkcija, lai atrastu datu masīvā indeksu, kas vistuvāk atbilst norādītajam laikam
  private getClosestIndexForTime(data: any[], timeInMs: number): number {
    let closestIndex = 0;
    let minDifference = Infinity;
  
    data.forEach((item, index) => { // Iterē cauri visiem datiem, lai atrastu vistuvāko punktu
      const itemTime = new Date(item.time).getTime(); // Pārveido datu laiku uz milisekundēm
      const difference = Math.abs(itemTime - timeInMs); // Aprēķina atšķirību starp pašreizējo laiku un norādīto laiku

      if (difference < minDifference) { // Ja šī atšķirība ir mazāka par līdz šim atrasto minimālo atšķirību
        closestIndex = index; // Atjauno tuvāko indeksu
        minDifference = difference; // Atjauno minimālo atšķirību
      }
    });
  
    return closestIndex;
  }

  // Atjaunina pašreizējā laika attēlojumu lietotāja saskarnē
  private updateCurrentTimeDisplay(): void {
    if (this.minTime) { 
      const currentTime = new Date(this.minTime.getTime() + this.selectedTimeIndex); // Aprēķina pašreizējo laiku, pieskaitot laika slīdņa(selectedTimeIndex) vērtību minimālajam laikam
      this.currentTime = this.formatTime(currentTime);
    }
  }

  //INDIKATORIEM//

  // Pārvieto laika slīdni uz konkrētu laika vērtību(milisekundēs)
  moveSliderToTime(timeInMs: number): void {
    this.selectedTimeIndex = timeInMs - this.minTime.getTime(); // Aprēķina relatīvo nobīdi no minimālā laika
    this.onTimeChange({ target: { value: this.selectedTimeIndex } }); // Atjauno laika stāvokli
  }

  // Iegūst apļa sākuma un beigu laikus konkrētajam braucējam
  getLapStartEnd(riderId: number): Array<{ label: string, time: number }> {
    const startEndData: Array<{ label: string, time: number }> = [];
    const laps = Array.from(this.selectedLaps).sort((a, b) => a - b); // Sakārto apļus augošā secībā
  
    // Iegūst reālo pēdējo apli no lastLapMap
    const realLastLap = this.lastLapMap.get(riderId);
  
    laps.forEach((lap, index) => {
      const lapData = this.filteredData[riderId]?.filter(item => item.lap === lap);
      if (lapData && lapData.length > 0) {
        // Pievieno apļa sākuma laiku
        startEndData.push({
          label: `s${lap}`,
          time: new Date(lapData[0].time).getTime()
        });
  
        // Pievieno apļa beigu laiku
        const nextLap = laps[index + 1];
        if (!nextLap || nextLap !== lap + 1 || lap === realLastLap) {
          startEndData.push({
            label: `e${lap}`,
            time: new Date(lapData[lapData.length - 1].time).getTime()
          });
        }
      }
    });
  
    // Vienmēr pievieno "End" indikatoru pēdējam aplim, ja tas ir reālais pēdējais aplis
    if (realLastLap) {
      const lastLapData = this.filteredData[riderId]?.filter(item => item.lap === realLastLap);
      if (lastLapData && lastLapData.length > 0) {
        const endIndicatorExists = startEndData.some(
          item => item.label === 'End' && item.time === new Date(lastLapData[lastLapData.length - 1].time).getTime()
        );
  
        if (!endIndicatorExists) {
          startEndData.push({
            label: 'End',
            time: new Date(lastLapData[lastLapData.length - 1].time).getTime()
          });
        }
      }
    }
  
    return startEndData;
  }
  

  
  // Aprēķina apļa indikatora pozīciju laika slīdnī procentos
  getLapIndicatorPosition(timeInMs: number): string {
    const percentage = ((timeInMs - this.minTime.getTime()) / (this.maxTime.getTime() - this.minTime.getTime())) * 100; // Aprēķina relatīvo pozīciju procentos
    return `${percentage}%`; // Atgriež procentuālo vērtību kā CSS vienību
  }

  // Aprēķina vertikālo nobīdi apļa indikatoram, ja vairākas indikatori pārklājas
  getIndicatorOffset(lapTime: number, riderId: number, timeThreshold: number = 1000): number {
    const lapIndicators: { riderId: number; time: number }[] = []; // Apkopo visus indikatorus

    // Iterē cauri visiem izvēlētajiem braucējiem
    Array.from(this.selectedRiders).forEach(id => {
        const laps = this.getLapStartEnd(id);
        laps.forEach(lap => {
            // Pievieno indikatoru, ja laika starpība starp pašreizējo un dotā apļa laiku ir pietiekami maza
            if (Math.abs(lap.time - lapTime) <= timeThreshold) {
                lapIndicators.push({ riderId: id, time: lap.time });
            }
        });
    });

    // Atrod pašreizējā braucēja indeksu apkopotajos indikatoros
    const index = lapIndicators.findIndex(indicator => indicator.riderId === riderId && Math.abs(indicator.time - lapTime) <= timeThreshold);
    return index * 25; // 25 pikseļu nobīde katram indikatoram
  }
}