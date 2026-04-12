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

De meeste samenwerking tussen services loopt via RabbitMQ. Ik heb dit vooral gedaan zodat de clock/deadline flow niet afhankelijk is van live HTTP calls naar alle andere services.

De belangrijkste events/queues:

| Event/queue | Van | Naar | Gebruik |
| --- | --- |
| `clock.target-created` | `target-service` | `clock-service` | Clock-service start tracking van een nieuwe target |
| `target.deleted` | `target-service` | `register-service`, `score-service`, `clock-service` | Andere services ruimen data/tracking op wanneer een target weg is |
| `registration.created` | `register-service` | `clock-service` | Clock-service slaat een snapshot op van ingeschreven deelnemers |
| `registration.deleted` | `register-service` | `clock-service` | Clock-service haalt een participant uit zijn snapshot |
| `submission.created` | `score-service` | `clock-service` | Clock-service slaat een snapshot op van ingestuurde scores |
| `submission.deleted` | `score-service` | `clock-service` | Clock-service haalt een submission uit zijn snapshot |
| `competition.expired` | `clock-service` | `register-service` | Register-service sluit registraties voor de verlopen target |
| `winner.determined` | `clock-service` | `target-service` | Target-service zet de target op gesloten en slaat winnaar/score op |
| `mail.reminders` | `clock-service` | `mail-service` | Mail-service verstuurt reminders |
| `mail.target-results` | `clock-service` | `mail-service` | Mail-service verstuurt resultaten |

De `clock-service` heeft daarom ook een eigen kleine database met snapshots:

| Snapshot | Waarom |
| --- | --- |
| `TrackedCompetition` | Welke targets lopen, deadline, owner en status |
| `ClockRegistration` | Welke deelnemers zijn ingeschreven |
| `ClockSubmission` | Welke deelnemers al iets hebben ingestuurd en met welke score |

Hierdoor hoeft de `clock-service` bij een deadline niet eerst live registraties, submissions en users op te vragen via internal HTTP. Als een service tijdelijk offline is, kan RabbitMQ het bericht later alsnog afleveren.

## Internal HTTP

Er is nog maar een kleine internal/demo API over via de gateway:

| Route | Gebruik |
| --- | --- |
| `POST /api/internal/clock/run` | Handmatig de clock cycle starten voor Postman/demo |
| `POST /api/internal/clock/targets/start` | Handmatige fallback om tracking voor een target te starten |

Deze routes zijn vooral handig voor het assessment. De normale flow gebruikt `target-created` via RabbitMQ.

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
