# Advance Payment Deduction Route

## Overview
This route allows you to deduct an amount from a customer's advance payment and apply it to their outstanding balance (dues). If the deduction fully covers the dues, the customer's balance will be cleared.

## Endpoint
**POST** `/api/v1/transactions/advance-deduction`

## Request Body
```json
{
  "transactionId": "string (MongoDB ObjectId of the invoice)",
  "amount": "number (amount to deduct from advance payment)"
}
```

## How It Works
1. Finds the invoice transaction by the provided `transactionId`
2. Retrieves the customer associated with that invoice
3. Validates that the customer has available advance payment
4. Calculates the deduction amount (minimum of requested amount or available advance payment)
5. Deducts from the customer's advance payment
6. Reduces the customer's balance (dues)
7. If the balance reaches zero, marks the invoice as completed
8. Creates a new transaction record of type 'advance' to track the deduction

## Response
### Success (200 OK)
```json
{
  "success": true,
  "data": {
    "deductionAmount": 500,
    "remainingAdvancePayment": 1000,
    "remainingBalance": 0,
    "invoiceStatus": "completed",
    "transaction": {
      "_id": "...",
      "customerId": "...",
      "customerName": "John Doe",
      "type": "advance",
      "amount": 500,
      "status": "completed",
      "description": "Advance payment deduction applied to invoice ...",
      "reference": "ADV-..."
    }
  },
  "message": "Successfully deducted 500 from advance payment"
}
```

### Error Responses
- **400 Bad Request**: Missing required fields or invalid amount
- **404 Not Found**: Transaction or customer not found
- **400 Bad Request**: Transaction is not an invoice type
- **400 Bad Request**: Customer has no advance payment available

## Example Usage

### Using cURL
```bash
curl -X POST http://localhost:5000/api/v1/transactions/advance-deduction \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "60d5ec49f1b2c8b1f8e4e1a1",
    "amount": 500
  }'
```

### Using JavaScript (fetch)
```javascript
const response = await fetch('http://localhost:5000/api/v1/transactions/advance-deduction', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    transactionId: '60d5ec49f1b2c8b1f8e4e1a1',
    amount: 500
  })
});

const result = await response.json();
console.log(result);
```

## Business Logic
- The deduction amount cannot exceed the customer's available advance payment
- The deduction amount cannot exceed the requested amount
- If the customer's balance becomes zero after deduction, all dues are considered cleared
- The system automatically marks the invoice as 'completed' if all customer dues are cleared
- A new transaction of type 'advance' is created to maintain an audit trail

## Transaction Type
The route creates a new transaction with `type: 'advance'` which has been added to the Transaction model's allowed types:
- payment
- invoice
- customer
- credit
- debit
- **advance** (new)

## Notes
- No authentication is required (as per other routes in the system)
- The route follows the same pattern as other transaction routes
- All monetary calculations are handled server-side to ensure accuracy
- The route is idempotent-safe: each call creates a new advance deduction transaction
