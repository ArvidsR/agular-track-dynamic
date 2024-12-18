import { Component, OnInit, ViewChild } from '@angular/core';
import { Chart, ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { backgroundImagePlugin } from '../plugins/backgroundImagePlugin';
import { HttpClientModule } from '@angular/common/http';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.css'],
  standalone: true,
  imports: [BaseChartDirective, CommonModule, FormsModule, HttpClientModule]
})
export class ChartComponent implements OnInit {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  public scatterChartOptions: ChartConfiguration['options'] = {
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        display: false,
        suggestedMin: -60, // Suggested minimum
        suggestedMax: 60
      },
      y: {
        display: false,
        suggestedMin: -30, // Suggested minimum
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

  // Lietotāja interfeisa stāvoklis
  public step: string = 'start'; // Sākuma solis
  public heats: any[] = [];
  public selectedHeats: Set<number> = new Set();
  public riders: any[] = [];
  public selectedRiders: Set<number> = new Set();
  public laps: any[] = [];
  public selectedLaps: Set<number> = new Set();

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    Chart.register(backgroundImagePlugin);
    this.updateChart();
    this.step = 'start'; // Sākuma solis
  }

  // 1. Saņem pieejamos Heat no API
  getHeats(): void {
    this.apiService.getHeats().subscribe((data) => {
      this.heats = data;
      this.step = 'heat';
    });
  }

  resetSelectionsOnHeatChange(): void {
    this.selectedRiders.clear(); // Notīra visus braucējus
    this.selectedLaps.clear();   // Notīra visus apļus
    this.riders = [];            // Notīra braucēju datus
    this.laps = [];              // Notīra apļu datus
  }

  public selectedHeat: number | null = null; // Vienīgais atzīmētais Heat

  selectSingleHeat(heatId: number): void {
    if (this.selectedHeat === heatId) {
      this.selectedHeat = null; // Noņem atzīmi, ja to pašu atzīmē vēlreiz
      this.resetSelectionsOnHeatChange();
    } else {
      this.selectedHeat = heatId; // Iestata jauno Heat kā izvēlēto
      this.resetSelectionsOnHeatChange();
    }
  }

  proceedToRiders(): void {
    if (this.selectedHeat !== null) {
      this.apiService.getRiders(this.selectedHeat.toString()).subscribe((data) => {
        this.riders = data.map((rider: any) => ({
          riderID: rider.riderID, // API atgriež riderID
          name: rider.name        // Rider vārds
        }));
        this.step = 'rider';
      });
    }
  }
  
  toggleRiderSelection(riderId: number): void {
    this.selectedRiders.has(riderId)
      ? this.selectedRiders.delete(riderId)
      : this.selectedRiders.add(riderId);
  }

  proceedToLaps(): void {
    const selectedHeat = this.selectedHeat; // Vienīgais Heat
    const selectedRidersArray = Array.from(this.selectedRiders);
  
    const lapRequests = selectedRidersArray.map((rider) =>
      this.apiService.getLaps(selectedHeat!.toString(), rider.toString())
    );
  
    Promise.all(lapRequests.map((req) => req.toPromise())).then((responses) => {
      this.laps = Array.from(new Set(responses.flat())); // Apvieno visus apļus
      this.step = 'lap';
    });
  }

  toggleLapSelection(lapId: number): void {
    this.selectedLaps.has(lapId) ? this.selectedLaps.delete(lapId) : this.selectedLaps.add(lapId);
  }

  goBack(): void {
    const stepOrder = ['start', 'heat', 'rider', 'lap', 'chart'];
    const currentIndex = stepOrder.indexOf(this.step);
  
    if (currentIndex > 0) {
      this.step = stepOrder[currentIndex - 1];
  
      if (this.step === 'heat') {
        this.resetSelectionsOnHeatChange(); // Atiestata visus Riders un Laps
      } else if (this.step === 'rider') {
        this.selectedLaps.clear(); // Atiestata tikai apļus, ja iet atpakaļ uz Riders
      }
    }
  }

  private pointColors: string[] = [
    'red', 'orange', 'cyan', 'purple', 'yellow', 'pink',
    'lightgreen', 'black', 'gray', 'green', 'gold', 'blue'
  ];
  
  private riderColorMap: Map<number, string> = new Map();

  public getColorForRider(riderId: number): string {
    if (!this.riderColorMap.has(riderId)) {
      const colorIndex = this.riderColorMap.size % this.pointColors.length;
      this.riderColorMap.set(riderId, this.pointColors[colorIndex]);
    }
    return this.riderColorMap.get(riderId)!;
  }

  /// scatter chart funkcija, kas parāda uzreiz visu trajektoriju braucējam  ///
  updateChart(): void {
    if (!this.selectedHeat) {
      console.error('No heat selected!');
      return;
    }
  
    if (this.selectedRiders.size === 0 || this.selectedLaps.size === 0) {
      console.error('No riders or laps selected!');
      return;
    }
  
    const scatterRequests = Array.from(this.selectedRiders).flatMap((rider) =>
      Array.from(this.selectedLaps).map((lap) =>
        this.apiService.getScatterData(this.selectedHeat!.toString(), rider.toString(), lap.toString())
      )
    );
  
    Promise.all(scatterRequests.map((req) => firstValueFrom(req))).then((responses) => {
      const datasets: ChartData<'scatter'>['datasets'] = [];
      const scatterDataByRiderLap: { [key: string]: any[] } = {};
  
      let responseIndex = 0;
  
      // Clear filteredData before repopulating
      this.filteredData = {};
  
      // Group data by rider and lap and store in filteredData
      Array.from(this.selectedRiders).forEach((riderId: number) => {
        this.filteredData[riderId] = []; // Initialize filteredData for rider
  
        Array.from(this.selectedLaps).forEach((lap: number) => {
          const key = `${riderId}-${lap}`;
          const riderLapData: any[] = responses[responseIndex++] || [];
  
          // Add data to filteredData
          this.filteredData[riderId].push(
            ...riderLapData.map((item: any) => ({ ...item, lap }))
          );
  
          // Process path data for chart
          if (riderLapData.length > 0) {
            const pathData = riderLapData
              .filter((_: any, idx: number) => idx % 12 === 0) // Every 12th point
              .map((item: any) => ({ x: item.x, y: item.y }));
  
            datasets.push({
              label: `Rider ${riderId} - Lap ${lap}`,
              data: pathData,
              backgroundColor: this.getColorForRider(riderId),
              pointRadius: 3,
            });
          }
        });
      });
  
      // Destroy the old chart and create a new one
      if (this.chart?.chart) {
        this.chart.chart.destroy();
      }
  
      this.scatterChartData = { datasets };
  
      // Update time and highlighted points
      this.updateMinMaxTime(); 
      this.updateCurrentTimeDisplay();
      this.updateHighlightedPoints();
  
      setTimeout(() => {
        this.chart?.update();
      }, 0);
  
      this.step = 'chart';
    }).catch((error) => {
      console.error('Error generating scatter chart:', error);
    });
  }

  public selectedTimeIndex: number = 0;
  public maxTimeIndex: number = 0;
  public startTime: string = '';
  public currentTime: string = '';
  public endTime: string = '';
  public minTime: Date = new Date();
  public maxTime: Date = new Date();

  private filteredData: { [riderId: number]: any[] } = {}; // Saglabā datus katram braucējam
  public trackerData: { [riderId: number]: { speed: number; s: number; d: number; isActive: boolean } } = {};
  
  onTimeChange(event: any): void {
    const sliderValue = event.target.value;
    this.selectedTimeIndex = +sliderValue;
  
    // Aprēķinām pašreizējo laiku un atjaunojam displeju
    const currentTimeInMs = this.minTime.getTime() + this.selectedTimeIndex;
    this.currentTime = this.formatTime(new Date(currentTimeInMs));

    this.updateCurrentTimeDisplay(); // Atjauno pašreizējā laika attēlojumu
    // Atjaunojam izceltos punktus uz grafika
    this.updateHighlightedPoints();
  }

  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0'); // Lokālās stundas
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }
  
  private updateMinMaxTime(): void {
    let minTime = Infinity;
    let maxTime = -Infinity;
  
    for (const rider of this.selectedRiders) {
      for (const lap of this.selectedLaps) {
        const lapData = this.filteredData[rider]?.filter((item) => item?.lap === lap);
        if (lapData && lapData.length > 0) {
          const startTime = new Date(lapData[0].time).getTime();
          const endTime = new Date(lapData[lapData.length - 1].time).getTime();
  
          minTime = Math.min(minTime, startTime);
          maxTime = Math.max(maxTime, endTime);
        }
      }
    }
  
    if (minTime === Infinity || maxTime === -Infinity) {
      console.error('No valid time data found!');
      return;
    }
  
    this.minTime = new Date(minTime);
    this.maxTime = new Date(maxTime);
    this.startTime = this.formatTime(this.minTime);
    this.endTime = this.formatTime(this.maxTime);
    this.maxTimeIndex = maxTime - minTime;
  }
  
 /// scatter chart, kas parāda kā braucējs kustās, lietotājam kustinot laika slīdni ///
  private updateHighlightedPoints(): void {
    const highlightedPoints: ChartData<'scatter'>['datasets'] = [];
  
    Array.from(this.selectedRiders).forEach((riderId) => {
      const combinedData: any[] = [];
  
      // Apvieno datus no visiem izvēlētajiem apļiem
      Array.from(this.selectedLaps).forEach((lap) => {
        const lapData = this.filteredData[riderId]?.filter((item) => item.lap === lap);
        if (lapData) combinedData.push(...lapData);
      });
  
      combinedData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  
      // Aprēķinām minimālo un maksimālo laiku priekš šī braucēja
      const trackerMinTime = combinedData.length > 0 ? new Date(combinedData[0].time).getTime() : null;
      const trackerMaxTime = combinedData.length > 0 ? new Date(combinedData[combinedData.length - 1].time).getTime() : null;
  
      const relativeTime = this.minTime.getTime() + this.selectedTimeIndex;
  
      if (trackerMinTime !== null && trackerMaxTime !== null && relativeTime >= trackerMinTime && relativeTime <= trackerMaxTime) {
        // Ja pašreizējais laiks ir intervālā, braucējs ir aktīvs
        const closestIndex = this.getClosestIndexForTime(combinedData, relativeTime);
        const dataAtTime = combinedData[closestIndex];
  
        if (dataAtTime) {
          highlightedPoints.push({
            label: `Current Position - Rider ${riderId}`,
            data: [{ x: dataAtTime.x, y: dataAtTime.y }],
            backgroundColor: this.getColorForRider(riderId),
            pointRadius: 10
          });
  
          this.trackerData[riderId] = {
            speed: dataAtTime.real_speed * 3.6, // Pārvērš km/h
            s: dataAtTime.s,
            d: dataAtTime.d,
            isActive: true
          };
        }
      } else {
        // Ja pašreizējais laiks nav intervālā, braucējs ir neaktīvs
        this.trackerData[riderId] = {
          speed: 0,
          s: 0,
          d: 0,
          isActive: false
        };
      }
    });
  
    // Atjauno scatterChartData
    this.scatterChartData = {
      datasets: [
        ...this.scatterChartData.datasets.filter((ds) => !ds.label?.startsWith('Current Position')),
        ...highlightedPoints
      ]
    };
    this.chart?.update();
  }

  private getClosestIndexForTime(data: any[], timeInMs: number): number {
    let closestIndex = 0;
    let minDifference = Infinity;
  
    data.forEach((item, index) => {
      const itemTime = new Date(item.time).getTime();
      const difference = Math.abs(itemTime - timeInMs);
      if (difference < minDifference) {
        closestIndex = index;
        minDifference = difference;
      }
    });
  
    return closestIndex;
  }

  private updateCurrentTimeDisplay(): void {
    if (this.minTime) { 
      const currentTime = new Date(this.minTime.getTime() + this.selectedTimeIndex);
      this.currentTime = this.formatTime(currentTime);
    }
  }

  //INDIKATORIEM//

  moveSliderToTime(timeInMs: number): void {
    this.selectedTimeIndex = timeInMs - this.minTime.getTime();
    this.onTimeChange({ target: { value: this.selectedTimeIndex } });
  }

  getLapStartEnd(riderId: number): Array<{ label: string, time: number }> {
    const startEndData: Array<{ label: string, time: number }> = [];
    const laps = Array.from(this.selectedLaps);
  
    laps.sort((a, b) => a - b);
  
    laps.forEach((lap, index) => {
      const lapData = this.filteredData[riderId]?.filter(item => item.lap === lap);
      if (lapData && lapData.length > 0) {
        startEndData.push({
          label: `s${lap}`, // Apļa sākuma laiks
          time: new Date(lapData[0].time).getTime()
        });
  
        const nextLap = laps[index + 1];
        if (nextLap !== lap + 1 || index === laps.length - 1) {
          startEndData.push({
            label: `e${lap}`, // Apļa beigu laiks
            time: new Date(lapData[lapData.length - 1].time).getTime()
          });
        }
      }
    });
    return startEndData;
  }
  
  getLapIndicatorPosition(timeInMs: number): string {
    const percentage = ((timeInMs - this.minTime.getTime()) / (this.maxTime.getTime() - this.minTime.getTime())) * 100;
    return `${percentage}%`;
  }

  getIndicatorOffset(lapTime: number, riderId: number): number {
    const lapIndicators: number[] = []; // Apkopojam visus indikatorus
  
    Array.from(this.selectedRiders).forEach(id => {
      const laps = this.getLapStartEnd(id);
      laps.forEach(lap => {
        if (lap.time === lapTime) {
          lapIndicators.push(id);
        }
      });
    });
  
    // Atrodam pašreizējā braucēja indeksu apkopotajos indikatoros
    const index = lapIndicators.indexOf(riderId);
    return index * 24; // 24px nobīde katram indikatoram
  }
}