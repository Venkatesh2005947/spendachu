"""
Receipt Parser — Rule-based extraction of structured receipt fields from OCR text.

Takes a list of {text, confidence} dicts from PaddleOCR and extracts:
  - merchant name
  - total/grand total amount
  - tax amount
  - date (YYYY-MM-DD)
  - time (HH:MM)
  - category (Food, Transport, Rent, Shopping, Bills, Entertainment, Others)
  - payment method (Cash, Card, UPI, Bank Transfer)
  - notes (item summary)

Each field has a confidence boolean (True = high confidence, False = uncertain).
The output format exactly matches what SpendAchu's ReceiptPreview.jsx expects.
"""

import re
import logging
from datetime import datetime, date

logger = logging.getLogger("paddle-ocr-service")

# ---------------------------------------------------------------------------
# Category keyword maps
# ---------------------------------------------------------------------------
CATEGORY_KEYWORDS = {
    "Food": [
        "restaurant", "cafe", "coffee", "pizza", "burger", "chicken", "food",
        "bakery", "sweets", "biryani", "dosa", "idli", "meals", "dining",
        "kitchen", "canteen", "eatery", "snack", "juice", "tea", "starbucks",
        "mcdonald", "kfc", "domino", "subway", "zomato", "swiggy", "hotel",
        "dhaba", "tiffin", "mess", "cakes", "ice cream", "dairy", "chaat",
        "pani puri", "samosa", "noodles", "momos", "paratha", "thali",
        "fast food", "dine", "bistro", "grill",
    ],
    "Transport": [
        "uber", "ola", "rapido", "auto", "taxi", "petrol", "diesel", "fuel",
        "parking", "toll", "metro", "bus", "train", "railway", "irctc",
        "redbus", "flight", "airline", "cab", "ride", "transport", "gas station",
        "shell", "hp petrol", "bharat petroleum", "indian oil",
    ],
    "Shopping": [
        "mart", "mall", "store", "shop", "bazaar", "amazon", "flipkart",
        "myntra", "ajio", "retail", "supermarket", "hypermarket", "dmart",
        "reliance", "big bazaar", "more", "spencer", "fashion", "clothing",
        "textile", "footwear", "electronics", "croma", "vijay sales",
        "decathlon", "ikea",
    ],
    "Bills": [
        "electric", "electricity", "water", "gas bill", "internet", "broadband",
        "airtel", "jio", "vodafone", "bsnl", "recharge", "mobile", "phone bill",
        "insurance", "premium", "emi", "subscription", "netflix", "spotify",
        "hotstar", "dth", "tata sky", "dish tv",
    ],
    "Entertainment": [
        "movie", "cinema", "theatre", "theater", "pvr", "inox", "imax",
        "concert", "event", "ticket", "park", "amusement", "game", "gaming",
        "bowling", "zoo", "museum", "club", "lounge", "bar", "pub",
        "bookmyshow",
    ],
    "Rent": [
        "rent", "lease", "landlord", "tenant", "housing",
    ],
}

PAYMENT_KEYWORDS = {
    "UPI": ["upi", "phonepe", "google pay", "gpay", "paytm", "bhim", "phonpe"],
    "Card": [
        "card", "visa", "mastercard", "rupay", "debit", "credit",
        "credit card", "debit card", "amex", "diners",
    ],
    "Bank Transfer": ["neft", "rtgs", "imps", "bank transfer", "net banking"],
    "Cash": ["cash", "paid cash"],
}

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Amount patterns — capture numbers with optional decimals
# Match "Total: 250.00", "Grand Total Rs. 1,234.56", "AMOUNT: ₹ 500", etc.
TOTAL_PATTERNS = [
    # Highest priority — Grand Total / Net Total
    re.compile(r"(?:grand\s*total|net\s*(?:total|amount|payable)|amount\s*(?:due|payable)|pay(?:able)?)\s*[:=]?\s*[₹$€£]?\s*([\d,]+\.?\d*)", re.IGNORECASE),
    # Standard total
    re.compile(r"(?:total|tot(?:al)?|bill\s*amount|sub\s*total)\s*[:=]?\s*[₹$€£]?\s*([\d,]+\.?\d*)", re.IGNORECASE),
    # Rs/INR prefix
    re.compile(r"(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)", re.IGNORECASE),
]

TAX_PATTERNS = [
    re.compile(r"(?:(?:c?gst|sgst|igst|vat|tax|service\s*(?:tax|charge)|gst)\s*(?:@\s*\d+%?)?\s*[:=]?\s*[₹$€£]?\s*)([\d,]+\.?\d*)", re.IGNORECASE),
]

# Date patterns — handles multiple formats common on Indian & international receipts
DATE_PATTERNS = [
    # DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    re.compile(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})"),
    # YYYY-MM-DD (ISO)
    re.compile(r"(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})"),
    # DD Mon YYYY, DD-Mon-YYYY
    re.compile(
        r"(\d{1,2})\s*[/\-.]?\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*[/\-.,]?\s*(\d{2,4})",
        re.IGNORECASE,
    ),
]

TIME_PATTERNS = [
    # 14:30, 2:30 PM, 14:30:45
    re.compile(r"(\d{1,2}:\d{2})\s*(?::\d{2})?\s*(?:AM|PM|am|pm)?"),
]

# Lines that are typically merchant name (first meaningful text line)
SKIP_WORDS = {
    "receipt", "invoice", "bill", "tax invoice", "cash memo", "retail",
    "original", "copy", "duplicate", "welcome", "thank you", "thanks",
    "customer", "date", "time", "total", "subtotal", "sub-total",
    "gst", "cgst", "sgst", "igst", "tax", "amount", "qty", "quantity",
    "item", "items", "sr", "no", "sl", "description", "price", "rate",
    "discount", "payment", "change", "balance", "cash", "card",
    "upi", "refund", "void", "vat", "service", "charge",
}


class ReceiptParser:
    """Rule-based receipt field extractor."""

    def parse(self, lines: list[dict]) -> dict:
        """
        Parse OCR text lines into structured receipt data.

        Args:
            lines: list of {"text": str, "confidence": float} dicts

        Returns:
            dict matching the SpendAchu ReceiptPreview expected format
        """
        full_text = "\n".join(ln["text"] for ln in lines)
        all_texts = [ln["text"] for ln in lines]
        avg_conf = sum(ln["confidence"] for ln in lines) / len(lines) if lines else 0

        # Extract each field
        merchant, merchant_conf = self._extract_merchant(all_texts, lines)
        amount, amount_conf = self._extract_amount(full_text, all_texts)
        tax, tax_conf = self._extract_tax(full_text)
        extracted_date, date_conf = self._extract_date(full_text)
        extracted_time, time_conf = self._extract_time(full_text)
        category, cat_conf = self._detect_category(full_text, merchant or "")
        payment, pay_conf = self._detect_payment_method(full_text)
        notes = self._extract_notes(all_texts, merchant)

        return {
            "merchant": merchant,
            "date": extracted_date,
            "time": extracted_time,
            "amount": amount,
            "tax": tax,
            "category": category,
            "paymentMethod": payment,
            "notes": notes,
            "confidence": {
                "merchant": merchant_conf,
                "date": date_conf,
                "time": time_conf,
                "amount": amount_conf,
                "tax": tax_conf,
                "category": cat_conf,
                "paymentMethod": pay_conf,
            },
        }

    # ------------------------------------------------------------------
    # Merchant extraction
    # ------------------------------------------------------------------
    def _extract_merchant(self, texts: list[str], lines: list[dict]) -> tuple:
        """
        Extract merchant name from the first meaningful text line.
        Receipts typically have the merchant/store name at the top.
        """
        for i, text in enumerate(texts):
            clean = text.strip()
            if len(clean) < 2:
                continue

            # Skip lines that are just numbers, dates, or common header words
            lower = clean.lower()

            # Skip if the line is purely numeric or a date/time
            if re.match(r"^[\d\s:.,/\-₹$]+$", clean):
                continue

            # Skip common receipt keywords
            words = set(lower.split())
            if words.issubset(SKIP_WORDS) or len(words) == 0:
                continue

            # Skip very long lines (probably item descriptions)
            if len(clean) > 60:
                continue

            # Skip lines with price-like patterns at the end
            if re.search(r"\d+\.\d{2}\s*$", clean) and len(clean) > 15:
                continue

            # This looks like a merchant name
            conf = lines[i]["confidence"] >= 0.8 if i < len(lines) else False
            # Clean up merchant name
            merchant = re.sub(r"\s+", " ", clean).strip()
            # Remove trailing punctuation that's not part of a name
            merchant = re.sub(r"[:\-=]+$", "", merchant).strip()
            return merchant, conf

        return None, False

    # ------------------------------------------------------------------
    # Amount extraction
    # ------------------------------------------------------------------
    def _extract_amount(self, full_text: str, texts: list[str]) -> tuple:
        """
        Extract the total amount from the receipt.
        Prioritizes Grand Total > Total > largest amount.
        """
        amounts = []

        # Try total patterns in priority order
        for pattern in TOTAL_PATTERNS:
            for match in pattern.finditer(full_text):
                try:
                    val = float(match.group(1).replace(",", ""))
                    if 0 < val < 1_000_000:  # Sanity check
                        amounts.append(val)
                except (ValueError, IndexError):
                    continue

        if amounts:
            # Return the largest total found (grand total > subtotal)
            amount = max(amounts)
            return round(amount, 2), True

        # Fallback: find all numbers and pick the largest reasonable one
        all_nums = re.findall(r"[\d,]+\.?\d*", full_text)
        fallback = []
        for n in all_nums:
            try:
                val = float(n.replace(",", ""))
                if 1 < val < 500_000:
                    fallback.append(val)
            except ValueError:
                continue

        if fallback:
            return round(max(fallback), 2), False

        return None, False

    # ------------------------------------------------------------------
    # Tax extraction
    # ------------------------------------------------------------------
    def _extract_tax(self, full_text: str) -> tuple:
        """Extract tax amount (GST, CGST, SGST, VAT, etc.)."""
        taxes = []
        for pattern in TAX_PATTERNS:
            for match in pattern.finditer(full_text):
                try:
                    val = float(match.group(1).replace(",", ""))
                    if 0 < val < 100_000:
                        taxes.append(val)
                except (ValueError, IndexError):
                    continue

        if taxes:
            # Sum all tax components (CGST + SGST, etc.)
            total_tax = round(sum(taxes), 2)
            return total_tax, True

        return None, False

    # ------------------------------------------------------------------
    # Date extraction
    # ------------------------------------------------------------------
    def _extract_date(self, full_text: str) -> tuple:
        """Extract date in YYYY-MM-DD format."""
        for pattern in DATE_PATTERNS:
            match = pattern.search(full_text)
            if match:
                groups = match.groups()
                try:
                    if len(groups) == 3:
                        g1, g2, g3 = groups

                        # Check if first group is a month name
                        month_names = {
                            "jan": 1, "january": 1, "feb": 2, "february": 2,
                            "mar": 3, "march": 3, "apr": 4, "april": 4,
                            "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
                            "aug": 8, "august": 8, "sep": 9, "september": 9,
                            "oct": 10, "october": 10, "nov": 11, "november": 11,
                            "dec": 12, "december": 12,
                        }

                        if g2.lower() in month_names:
                            # DD Mon YYYY format
                            day = int(g1)
                            month = month_names[g2.lower()]
                            year = int(g3)
                            if year < 100:
                                year += 2000
                        elif len(g1) == 4:
                            # YYYY-MM-DD (ISO)
                            year, month, day = int(g1), int(g2), int(g3)
                        else:
                            # DD/MM/YYYY (most common on Indian receipts)
                            day, month, year = int(g1), int(g2), int(g3)

                        if year < 100:
                            year += 2000

                        # Validate
                        parsed_date = date(year, month, day)
                        return parsed_date.isoformat(), True

                except (ValueError, TypeError):
                    continue

        return None, False

    # ------------------------------------------------------------------
    # Time extraction
    # ------------------------------------------------------------------
    def _extract_time(self, full_text: str) -> tuple:
        """Extract time in HH:MM format."""
        for pattern in TIME_PATTERNS:
            match = pattern.search(full_text)
            if match:
                time_str = match.group(1)
                full_match = match.group(0).strip().upper()

                parts = time_str.split(":")
                hour = int(parts[0])
                minute = int(parts[1])

                # Handle AM/PM
                if "PM" in full_match and hour < 12:
                    hour += 12
                elif "AM" in full_match and hour == 12:
                    hour = 0

                if 0 <= hour <= 23 and 0 <= minute <= 59:
                    return f"{hour:02d}:{minute:02d}", True

        return None, False

    # ------------------------------------------------------------------
    # Category detection
    # ------------------------------------------------------------------
    def _detect_category(self, full_text: str, merchant: str) -> tuple:
        """Detect expense category from receipt text and merchant name."""
        combined = (full_text + " " + merchant).lower()

        # Score each category
        scores = {}
        for category, keywords in CATEGORY_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in combined)
            if score > 0:
                scores[category] = score

        if scores:
            best = max(scores, key=scores.get)
            # High confidence if multiple keyword matches
            return best, scores[best] >= 2

        return "Others", False

    # ------------------------------------------------------------------
    # Payment method detection
    # ------------------------------------------------------------------
    def _detect_payment_method(self, full_text: str) -> tuple:
        """Detect payment method from receipt text."""
        lower = full_text.lower()

        for method, keywords in PAYMENT_KEYWORDS.items():
            for kw in keywords:
                if kw in lower:
                    return method, True

        return "Cash", False

    # ------------------------------------------------------------------
    # Notes extraction
    # ------------------------------------------------------------------
    def _extract_notes(self, texts: list[str], merchant: str | None) -> str | None:
        """
        Extract a brief note/description from item lines.
        Picks up to 3 likely item description lines.
        """
        items = []
        merchant_lower = (merchant or "").lower()

        for text in texts:
            clean = text.strip()
            lower = clean.lower()

            # Skip very short or very long lines
            if len(clean) < 3 or len(clean) > 50:
                continue

            # Skip the merchant line itself
            if merchant_lower and lower == merchant_lower:
                continue

            # Skip lines that are mostly numbers
            alpha_ratio = sum(1 for c in clean if c.isalpha()) / max(len(clean), 1)
            if alpha_ratio < 0.3:
                continue

            # Skip common header/footer/keyword lines
            words = set(lower.split())
            if words.issubset(SKIP_WORDS):
                continue

            # Skip lines with amount-like patterns
            if re.match(r".*\b(total|subtotal|tax|gst|cgst|sgst|grand|net|amount|balance|change|discount)\b.*", lower):
                continue

            # Skip address-like lines (contain pin codes, phone numbers)
            if re.search(r"\b\d{6}\b|\b\d{10}\b|ph\s*[:.]|tel\s*[:.#]|phone|email|www\.|\.com|gstin", lower):
                continue

            items.append(clean)

            if len(items) >= 3:
                break

        return ", ".join(items) if items else None
