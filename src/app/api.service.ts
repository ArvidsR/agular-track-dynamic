import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {

  private baseUrl: string = 'http://localhost:3000/api'; // Express servera URL

  constructor(private http: HttpClient) { }

  // Funkcija, lai iegūtu visus heat
  getHeats(): Observable<any> {
    return this.http.get(`${this.baseUrl}/heat`);
  }

  // Funkcija, lai iegūtu visus riders attiecīgajam heat
  getRiders(heat: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/riders/${heat}`);
  }

  // Funkcija, lai iegūtu visus laps attiecīgajam heat un rider
  getLaps(heat: string, rider: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/laps/${heat}/${rider}`);
  }

  // Funkcija, lai iegūtu scatter plot datus
  getScatterData(heat: string, rider: string, lap: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/scatter-data/${heat}/${rider}/${lap}`);
  }
}