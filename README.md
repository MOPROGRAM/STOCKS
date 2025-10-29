# TradingView Watchlist

Static site that shows a TradingView chart on the left and a right-side watchlist.

## Features

- Responsive layout: chart (75%) + watchlist (25%) on desktop, stacked on mobile
- Click a symbol on the watchlist to load it into the TradingView chart
- Filter box to search symbols

## How to run locally

Start a static server in the repository root (Python 3 example):

```bash
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

## Deploy to Netlify

1. Push this repo to GitHub.
2. Create a Site on Netlify and connect to the repo (build settings: none, publish directory: root).

## Notes

- The TradingView widget is embedded using TradingView's public tv.js. Some tickers may require exchange prefixes (e.g., `NASDAQ:TSLA`, `NYSE:IBM`). This app attempts to default to `NASDAQ:` when no prefix is provided.
- If you want ticker-to-exchange accuracy, provide a mapping in `data/watchlist.json` or update `assets/js/app.js` to map tickers to exchanges.

Enjoy — the site is ready to deploy to Netlify as a static site.
# STOCKS