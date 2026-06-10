
import json
import random
import math
import os
from datetime import datetime, timedelta

# Seed for reproducibility
random.seed(42)

class MarketDataEngine:
    def __init__(self, trading_days_per_month=21):
        self.trading_days_per_month = trading_days_per_month

    def generate_daily_series(self, start_price, end_price, days, volatility):
        """
        Brownian Bridge: Generates a random walk that ends exactly at end_price.
        """
        if days <= 0: return []
        
        log_start = math.log(start_price)
        log_end = math.log(end_price)
        
        total_log_return = log_end - log_start
        avg_daily_log_return = total_log_return / days
        
        # Generate random walk with noise
        unconstrained_returns = [random.normalvariate(avg_daily_log_return, volatility) for _ in range(days)]
        actual_sum = sum(unconstrained_returns)
        error = total_log_return - actual_sum
        
        # Distribute error linearly to maintain start/end integrity
        constrained_returns = [r + (error / days) for r in unconstrained_returns]
        
        prices = []
        curr_log = log_start
        for r in constrained_returns:
            curr_log += r
            prices.append(math.exp(curr_log))
            
        return prices

    def process_asset(self, asset_id, volatility):
        input_path = f"public/data/indices/{asset_id}.json"
        if not os.path.exists(input_path):
            print(f"Skipping {asset_id}: File not found at {input_path}")
            return

        with open(input_path, "r", encoding="utf-8") as f:
            meta = json.load(f)

        if meta.get("resolution") == "daily":
            print(f"Skipping {asset_id}: Already daily resolution.")
            return

        print(f"Processing {asset_id} (Volatility: {volatility*100:.2f}%)...")
        monthly_data = meta["data"]
        daily_data = []
        
        # We need a starting point. Let's assume the first entry's price as start_price
        # and back-extrapolate slightly or just start from the first day.
        # To have a return for the first day, we need a "previous" price.
        prev_day_price = monthly_data[0]["price"] / 1.01 
        
        for i, anchor in enumerate(monthly_data):
            target_price = anchor["price"]
            date_obj = datetime.strptime(anchor["date"], "%Y-%m-%d")
            year = date_obj.year
            month = date_obj.month
            
            days = self.trading_days_per_month
            month_prices = self.generate_daily_series(prev_day_price, target_price, days, volatility)
            
            div_yield_monthly = anchor.get("dividendYield", 0)
            div_yield_daily = div_yield_monthly / float(days)
            
            for d_idx, price in enumerate(month_prices):
                # Simple day spread: 1, 2, ..., 21 spread across ~28-31 days
                day_num = 1 + int(d_idx * 28 / days)
                date_str = f"{year}-{month:02d}-{day_num:02d}"
                
                daily_data.append({
                    "date": date_str,
                    "price": round(price, 2),
                    "dividendYield": round(div_yield_daily, 8)
                })
                prev_day_price = price
        
        meta["data"] = daily_data
        meta["resolution"] = "daily"
        
        output_path = f"public/data/indices/{asset_id}.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
        print(f"Successfully updated {asset_id}.json to daily resolution.")

if __name__ == "__main__":
    engine = MarketDataEngine()
    
    # Configuration for assets that need daily conversion
    # Volatilities are estimated daily std dev
    configs = [
        ("spy", 0.010),      # S&P 500
        ("kospi", 0.011),    # KOSPI 200
        ("gold", 0.009),     # Gold
        ("kosdaq", 0.015),   # KOSDAQ
        ("schd", 0.0085),    # SCHD (Lower vol)
    ]
    
    for asset_id, vol in configs:
        engine.process_asset(asset_id, vol)

    print("All requested assets processed.")
