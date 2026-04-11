# Photo Prestiges

Photo Prestiges is een microservice project voor Cloud Services. Het idee is dat een target owner een foto met locatie/deadline uploadt. Deelnemers kunnen zich inschrijven en daarna proberen om een zo gelijk mogelijke foto te uploaden. Na de deadline bepaalt het systeem automatisch een winnaar en worden mails verstuurd.

Ik heb geen echte GUI nodig voor de opdracht, dus de API is vooral bedoeld om met Postman te testen. Er zit wel een kleine demo frontend in de repo, maar de belangrijkste flow loopt via de API gateway.

## Services

De services draaien via Docker Compose.

| Service | Verantwoordelijkheid |
| --- | --- |
| `api-gateway` | Enige publieke ingang voor de API en serveert uploads/docs |
| `auth-service` | Registreren, login, JWT tokens, gebruikersgegevens |
| `target-service` | Targets, targetfoto upload, votes, target verwijderen |
| `register-service` | Inschrijven voor targets en registraties sluiten |
| `score-service` | Deelnemerfoto upload, Imagga analyse, score opslaan |
| `clock-service` | Deadlines, reminders, winnaar bepalen na deadline |
| `mail-service` | Mails sturen via RabbitMQ berichten |
| `read-service` | Dashboard/read endpoints voor overzichten |

Daarnaast draaien:

| Service | Gebruik |
| --- | --- |
| `mongo` | Database |
| `rabbitmq` | Message broker |
| `demo-frontend` | Simpele test/demo pagina |

## Databases

Elke microservice heeft zijn eigen database. Dat is bewust gedaan zodat services niet direct in elkaars tabellen/collections hoeven te zitten.

| Database | Service |
| --- | --- |
| `auth_db` | `auth-service` |
| `target_db` | `target-service` |
| `register_db` | `register-service` |
| `score_db` | `score-service` |
| `photo-prestiges-clock` | `clock-service` |

## Belangrijke URLs

| URL | Omschrijving |
| --- | --- |
| `http://localhost:3000` | API Gateway |
| `http://localhost:3000/docs` | Swagger docs |
| `http://localhost:5173` | Demo frontend |
| `http://localhost:15672` | RabbitMQ management |

RabbitMQ login:

```text
username: photo
password: photo123
```

## Project starten

Vanaf de project root:

```powershell
docker compose up -d --build
```

Logs bekijken:

```powershell
docker compose logs -f
```

Alle containers stoppen:

```powershell
docker compose down
```

Alles resetten, dus Mongo, RabbitMQ en uploads leegmaken:

```powershell
docker compose down -v
docker compose up -d --build
```

## Swagger docs

De centrale docs staan op:

```text
http://localhost:3000/docs
```

Daar staan twee specs in:

| Spec | Gebruik |
| --- | --- |
| `Gateway Public API` | Normale endpoints voor owner/participant |
| `Internal Demo API` | Alleen demo/internal endpoint om de clock handmatig te triggeren |

## Score en winnaar

De image similarity score komt uit de externe image analyse. Daarna gebruikt de clock-service een eindscore die rekening houdt met score en snelheid:

```text
finalScore = similarityScore * 0.75 + speedScore * 0.25
```

Hierdoor wint niet alleen de hoogste score automatisch. Een snellere inzending kan dus meewegen.

## Mail

De mail-service draait via RabbitMQ. De clock-service publiceert berichten voor:

| Queue | Doel |
| --- | --- |
| `mail.reminders` | Reminder naar deelnemers die nog niets hebben ingestuurd |
| `mail.target-results` | Resultaten na de deadline |

Na de deadline:

- de target owner krijgt een overzicht met alle deelnemers/scores
- elke deelnemer krijgt apart zijn eigen score

Standaard staat `MAIL_MODE=ethereal`. In de logs van `mail-service` komt dan een Ethereal preview URL te staan waarmee je de mail kunt bekijken.

## RabbitMQ events

De belangrijkste events:

| Event/queue | Gebruik |
| --- | --- |
| `clock.target-created` | Clock-service start tracking van een target |
| `target.deleted` | Register/score/clock-service ruimen data of tracking op |
| `mail.reminders` | Mail-service verstuurt reminders |
| `mail.target-results` | Mail-service verstuurt resultaten |

## Security

Gewone gebruikers gebruiken JWT tokens:

```http
Authorization: Bearer <token>
```

Interne/demo endpoints gebruiken:

```http
x-internal-service-token: photo-prestiges-internal-secret
```

In Docker is alleen de API gateway publiek beschikbaar op poort `3000`. De andere services praten intern met elkaar via Docker networking.

## Externe service

Voor image analyse wordt Imagga gebruikt. De credentials moeten in `score-service/.env`:

```text
IMAGGA_API_KEY=...
IMAGGA_API_SECRET=...
```
