# Advance Payment Complete Guide

## Overview
This document explains the complete advance payment system including adding advance payments to customers and deducting them from invoices.

## Available Routes

### 1. Add Advance Payment to Customer
**POST** `/api/v1/customers/:id/advance-payment`

This route adds money to a customer's advance payment balance.

**Request Body:**
```json
{
  "amount": 1000,
  "description": "Advance payment for future orders"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "John Doe",
    "advancePayment": 1000,
    "balance": 500,
    ...
  }
}
```

### 2. Use Advance Payment (Simple Deduction)
**POST** `/api/v1/customers/:id/use-advance`

This route deducts a specified amount from the customer's advance payment.

**Request Body:**
```json
{
  "amount": 500
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "John Doe",
    "advancePayment": 500,
    "balance": 500,
    ...
  }
}
```

### 3. Apply Advance Payment Deduction to Invoice (NEW)
**POST** `/api/v1/transactions/advance-deduction`

This NEW route applies advance payment to a specific invoice, automatically:
- Deducts from the customer's advance payment
- Reduces the customer's balance (dues)
- Marks the invoice as completed if balance reaches zero
- Creates an audit transaction record

**Request Body:**
```json
{
  "transactionId": "60d5ec49f1b2c8b1f8e4e1a1",
  "amount": 500
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deductionAmount": 500,
    "remainingAdvancePayment": 500,
    "remainingBalance": 0,
    "invoiceStatus": "completed",
    "transaction": {
      "_id": "...",
      "type": "advance",
      "amount": 500,
      ...
    }
  },
  "message": "Successfully deducted 500 from advance payment"
}
```

## Workflow Examples

### Example 1: Customer Makes Advance Payment
```javascript
// Customer pays 2000 as advance
await api.customers.addAdvancePayment(customerId, {
  amount: 2000,
  description: "Advance for next month"
});
// Customer's advancePayment = 2000
```

### Example 2: Create Invoice and Auto-Apply Advance
```javascript
// Create an invoice for 1500
const invoice = await api.transactions.create({
  customerId: customerId,
  type: 'invoice',
  amount: 1500,
  status: 'pending',
  dueDate: '2025-01-15'
});
// Customer's balance = 1500

// Apply advance payment to this invoice
await fetch('http://localhost:5000/api/v1/transactions/advance-deduction', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transactionId: invoice.data._id,
    amount: 1500
  })
});
// Customer's advancePayment = 500 (2000 - 1500)
// Customer's balance = 0 (fully paid)
// Invoice status = 'completed'
```

### Example 3: Partial Advance Payment
```javascript
// Customer has advance payment of 300
// Invoice amount is 1000

await fetch('http://localhost:5000/api/v1/transactions/advance-deduction', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transactionId: invoiceId,
    amount: 1000  // Requesting full amount
  })
});

// System automatically deducts only available amount (300)
// Customer's advancePayment = 0 (300 - 300)
// Customer's balance = 700 (1000 - 300)
// Invoice status = 'pending' (still has remaining balance)
```

## Key Features

### Smart Deduction Logic
- Automatically calculates the maximum deductible amount
- Never exceeds available advance payment
- Never exceeds the requested amount
- Updates customer balance accordingly

### Automatic Status Updates
- Marks invoice as 'completed' when balance reaches zero
- Maintains invoice as 'pending' if balance remains

### Audit Trail
- Creates a new transaction of type 'advance' for each deduction
- Links to the original invoice via reference
- Includes description for tracking

### Error Handling
- Validates transaction exists and is an invoice type
- Checks customer has available advance payment
- Prevents negative balances
- Provides clear error messages

## Database Schema Updates

### Transaction Model
Added new transaction type: **'advance'**

```javascript
type: {
  type: String,
  enum: ['payment', 'invoice', 'customer', 'credit', 'debit', 'advance']
}
```

### Customer Model (No Changes Needed)
Already supports:
```javascript
{
  advancePayment: Number,  // Available advance payment
  balance: Number,         // Outstanding dues
  totalCredit: Number,     // Total credit given
  totalPaid: Number        // Total payments received
}
```

## Testing the Routes

### Test 1: Add Advance Payment
```bash
curl -X POST http://localhost:5000/api/v1/customers/CUSTOMER_ID/advance-payment \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "description": "Test advance"}'
```

### Test 2: Apply Advance to Invoice
```bash
curl -X POST http://localhost:5000/api/v1/transactions/advance-deduction \
  -H "Content-Type: application/json" \
  -d '{"transactionId": "INVOICE_ID", "amount": 500}'
```

## Frontend Integration

The frontend already has the API methods defined. To use the new advance deduction route:

```typescript
// In your component
const applyAdvanceToInvoice = async (invoiceId: string, amount: number) => {
  const response = await fetch('http://localhost:5000/api/v1/transactions/advance-deduction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionId: invoiceId,
      amount: amount
    })
  });
  
  const result = await response.json();
  console.log(result);
};
```

## CORS Configuration
The backend is configured to accept requests from:
- http://localhost:5173 (Vite dev server)
- http://localhost:5174 (Alternative port)

Allowed methods: GET, POST, PUT, DELETE
Allowed headers: Content-Type, Authorization

## Notes
- All routes work without authentication (as per existing system design)
- Server must be running on port 5000
- MongoDB must be connected
- Server has been restarted to load all new routes
