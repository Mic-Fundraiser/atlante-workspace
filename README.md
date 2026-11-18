# Atlante

Una web app locale e un indice condiviso per chi usa più agenti di coding. Incolla il link di questo repository nella chat di un agente con accesso al tuo terminale e alle tue cartelle. La prima volta l’agente segue la procedura qui sotto. In seguito, le nuove chat degli ambienti configurati ricevono il riferimento allo stesso indice.

## Prima configurazione per l’agente

1. Clona questo repository in una cartella stabile. Usa Node.js 20 o successivo. Il progetto usa solo moduli standard.
2. Individua con l’utente le cartelle che contengono i suoi lavori. Se la richiesta indica già le radici, usale direttamente. Esegui dalla copia locale:
   ```sh
   node atlante.mjs scan "/percorso/dei/progetti" "/altra/raccolta"
   ```
   Passa tutte le radici desiderate insieme. Un successivo `scan` senza argomenti riusa la selezione salvata.
3. Se l’utente vuole che ogni nuova chat consulti Atlante, esegui `node atlante.mjs install`. Il comando aggiunge una regola globale ad AGENTS.md di Codex, CLAUDE.md di Claude Code e GEMINI.md di Gemini/Antigravity. Conserva il testo esistente e crea una copia di backup dei file modificati. La regola contiene il percorso assoluto dello script. Riesegui l’installazione se sposti il clone.
4. Esegui `node atlante.mjs brief` e verifica una ricerca con `node atlante.mjs find "parola"`. Per aprire la dashboard avvia `npm start` e apri l’indirizzo locale stampato. La consultazione da chat funziona anche con il server web spento.

## Nelle chat successive

- **brief** legge l’indice salvato. Restituisce data, numero dei progetti e un’anteprima di cinque progetti.
- **find** cerca in percorsi, tecnologie e note. Restituisce fino a quindici percorsi. Restringi la ricerca se ce ne sono altri.
- **ctx** riceve un percorso restituito da find e mostra la scheda, le guide e le cinque note più recenti del progetto.
- **log** registra una nota durevole sul progetto, per esempio una descrizione verificata dall’agente o dove riprendere un lavoro. Limite di 500 caratteri.
- **scan** aggiorna l’inventario. Le note restano associate al percorso assoluto.

```sh
node atlante.mjs find "fatture"
node atlante.mjs ctx "/progetti/fatture"
node atlante.mjs log "/progetti/fatture" "Importazione CSV in src/import. I formati ammessi sono descritti nel README."
```

Per contenere il contesto, la scansione esamina nomi e metadati. L’agente consulta le guide di un singolo progetto quando servono. Il consumo effettivo di token dipende dal modello e da ciò che la chat sceglie di leggere.

## Disco e dati

La dashboard mostra progetti annidati, dimensioni logiche, file sotto 4 KiB e file da almeno 10 MB. Per ogni progetto conta anche i byte in cartelle tipiche di dipendenze, cache e build. I progetti sono riconosciuti tramite Git o manifest Node, Python, Rust, Swift, Go, PHP e Java. Sono esclusi symlink e elementi nascosti, con eccezioni per indicatori Git e cartelle generate riconosciute. I file inaccessibili sono segnalati.

Dal browser puoi esaminare un file grande e confermarne lo spostamento nel Cestino su macOS o Linux con gio. Lo svuotamento del Cestino resta manuale. Il server ascolta su 127.0.0.1. I dati sono salvati in ~/.atlante, separati dal clone. Usa ATLANTE_HOME per un archivio alternativo, impostandolo in tutti gli ambienti interessati. PORT cambia la porta web.

Il link GitHub permette a un agente di trovare le istruzioni. Il primo avvio richiede un agente con terminale e accesso alla macchina. Le regole globali sono istruzioni per il modello: la loro applicazione dipende dal client, dalle sue impostazioni e dai permessi. Ogni macchina o profilo va configurato una volta.

## Sviluppo

`npm test` verifica scansione, schede, note e aggiornamento delle istruzioni in un ambiente temporaneo. Licenza MIT.
