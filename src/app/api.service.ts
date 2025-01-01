import { Injectable } from '@angular/core'; // Nodrošina, ka šo klasi var injicēt citās Angular komponentēs vai servisos.
import { HttpClient } from '@angular/common/http'; // Nodrošina iespēju veikt HTTP pieprasījumus (GET, POST utt.) uz serveri.
import { Observable } from 'rxjs'; // RxJS rīks datu plūsmu apstrādei. Šeit to izmanto, lai apstrādātu HTTP pieprasījumu atgrieztos datus.

@Injectable({
  providedIn: 'root', 
  // Nodrošina, ka šis serviss ir pieejams visā aplikācijā, izmantojot Angular DI (Dependency Injection).
})
export class ApiService {
  // Servera bāzes adrese
  private readonly baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  // Iegūst visus pieejamos braucienus
  getHeats(): Observable<any> {
    return this.http.get(`${this.baseUrl}/heat`);
  }

  // Iegūst visus pieejamos braucējus(rider) konkrētam braucienam(heat)
  getRiders(heat: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/riders/${heat}`);
  }

  // Iegūst visus apļus konkrētam barucienam(heat) un tā braucējam(rider)
  getLaps(heat: string, rider: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/laps/${heat}/${rider}`);
  }

  // Iegūst izkliedes diagrammas(scatter plot) datus konkrētam braucienam, braucējam, aplim
  getScatterData(heat: string, rider: string, lap: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/scatter-data/${heat}/${rider}/${lap}`);
  }
}