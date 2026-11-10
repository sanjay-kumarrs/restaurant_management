# Restaurant Management System (FoodHub)

A comprehensive, production-ready Frappe application developed for **FoodHub Restaurant** to streamline food menu management, table and delivery order processing, dynamic tax and bill calculations, workflow tracking, role-based security, and daily sales reporting.

---

## 📋 Restaurant Project – Completion Checklist

All requirements outlined in the developer practical assessment have been implemented, tested, and verified:

- [x] **Four Required DocTypes Created**: Configured `Food Category`, `Food Item`, `Restaurant Order`, and child table `Order Item`.
- [x] **Client Script Calculations Demonstrated**: Dynamic rate fetching, row amount calculation, real-time subtotal, itemized tax calculation, and grand total computation.
- [x] **Server-Side Validations Tested**: Strict validation preventing empty items, unavailable items, non-positive quantities, excessive discounts, and tampering with completed orders.
- [x] **REST APIs Developed & Tested in Postman**: Whitelisted methods for menu listing, item lookup, order details retrieval, and daily sales totals (all 4 APIs tested in Postman).
- [x] **Daily Sales Report Working with Date Filter**: Custom report built with multi-column order financial summaries and real-time date filtering.
- [x] **Workflow and Role Permissions Configured & Tested**: Implemented roles (`Restaurant Manager`, `Waiter`) and state transitions (`Draft` &rarr; `Confirmed` &rarr; `Completed` / `Cancelled`).
- [x] **Sample Data and Validation Screenshots Ready**: All 13 validation and testing scenarios documented and stored in the `screenshots/` folder.

---

## 🏛️ Part A – DocType Design & Data Architecture

The application defines four core DocTypes with relational links, auto-naming rules, and submittable states:

```
+--------------------+            +--------------------+
|   Food Category    | 1 ------ * |     Food Item      |
+--------------------+            +--------------------+
                                             |
                                             | 1
                                             |
                                             | *
+--------------------+ 1        * +--------------------+
|  Restaurant Order  | ---------- |     Order Item     |
|   (Submittable)    |   (Child)  |    (Child Table)   |
+--------------------+            +--------------------+
```

### 1. Food Category
* **DocType**: `Food Category`
* **Naming**: `FC-.#####` (Expression)
* **Fields**:
  * `category_name` (Data, Unique, Mandatory, In List View)
  * `description` (Small Text)

### 2. Food Item
* **DocType**: `Food Item`
* **Naming**: `FI-.#####` (Expression)
* **Fields**:
  * `item_name` (Data, Mandatory, In List View, Title Field)
  * `category` (Link to `Food Category`, Mandatory, In List View)
  * `price` (Currency, Mandatory, In List View)
  * `tax_percentage` (Percent, Default: `0`)
  * `availability` (Check, Default: `0`, In List View)

### 3. Order Item (Child Table)
* **DocType**: `Order Item`
* **Type**: Child Table (`istable: 1`, `editable_grid: 1`)
* **Naming**: `OI-.#####` (Expression)
* **Fields**:
  * `food_item` (Link to `Food Item`, Mandatory, In List View)
  * `quantity` (Int, Mandatory, Default: `1`, In List View)
  * `rate` (Currency, Mandatory, In List View)
  * `amount` (Currency, Read Only, In List View) – Computed as `quantity * rate`
  * `tax_percentage` (Percent, Read Only, In List View) – Auto-fetched from master

### 4. Restaurant Order
* **DocType**: `Restaurant Order` (Submittable DocType)
* **Naming**: `ORD-.#####` (Expression)
* **Fields**:
  * `customer_name` (Data, Mandatory, In List View)
  * `order_type` (Select: `Dine-in`, `Takeaway`, `Delivery`, Mandatory, In List View)
  * `order_date` (Date, Mandatory, Default: `Today`, In List View)
  * `items` (Table &rarr; `Order Item`, Mandatory)
  * `subtotal` (Currency, Read Only)
  * `discount` (Currency, Default: `0`)
  * `tax_amount` (Currency, Read Only)
  * `grand_total` (Currency, Read Only)
  * `status` (Select: `Draft`, `Confirmed`, `Completed`, `Cancelled`, Default: `Draft`, Read Only, Mandatory)
  * `workflow_state` (Link to `Workflow State`, Read Only)
  * `amended_from` (Link to `Restaurant Order`, Read Only)

---

## ⚡ Part B – Client-Side Form Logic (`restaurant_order.js`)

Client scripts handle instant visual feedback, form validations, and asynchronous calculation:

1. **Auto-Fetch Rate & Tax**: Selecting a `food_item` fetches the latest price, tax rate, and availability from the master database.
2. **Item Availability Warning**: If an unavailable food item is selected, a warning message is displayed immediately and row values are reset.
3. **Automated Row Calculation**: `Amount` is automatically computed as `Quantity × Rate`.
4. **Real-time Subtotal & Tax Calculation**:
   $$\text{Subtotal} = \sum (\text{Quantity} \times \text{Rate})$$
   $$\text{Tax Amount} = \sum \left(\text{Amount} \times \frac{\text{Tax Percentage}}{100}\right)$$
5. **Grand Total Computation**:
   $$\text{Grand Total} = \text{Subtotal} + \text{Tax Amount} - \text{Discount}$$
6. **Quantity Validation**: Enforces quantity $> 0$ with an informative message alert.
7. **Discount Boundary Check**: Prevents negative discounts and validates that discount does not exceed the subtotal.
8. **Date Verification**: Ensures order date cannot be set in the future.
9. **Custom 'Generate Bill' Button**: Available on saved orders to trigger a formatted bill modal dialog displaying customer details, itemized breakdown, tax summary, and net payable amount.

---

## 🛡️ Part C – Server-Side Validations (`restaurant_order.py`)

All computations and business constraints are reinforced on the server inside `validate()`:

| Rule | Implementation & Behavior |
|---|---|
| **Empty Order Prevention** | Throws error if `items` child table is empty (`Cannot save an order without food items.`). |
| **Availability Enforcement** | Re-verifies live database `availability` for every item; rejects order if item is currently marked unavailable. |
| **Quantity Validation** | Enforces `quantity > 0`; blocks zero or negative inputs (`Quantity must be greater than zero.`). |
| **Price & Discount Integrity** | Prevents negative prices and negative discount entries (`Discount cannot be negative.`). |
| **Discount Threshold** | Validates that discount does not exceed subtotal (`Discount cannot be greater than subtotal.`). |
| **Tamper-Proof Totals** | Pulls master rate and tax percentage directly from `Food Item` master, re-calculating `row.amount`, `subtotal`, `tax_amount`, and `grand_total` server-side before save/submit. |
| **Completed Order Lock** | Blocks modifications on orders in `Completed` status unless the user has the **Restaurant Manager** role. |

---

## 🌐 Part D – Python REST APIs (`restaurant_management/api.py`)

All endpoints are whitelisted under `@frappe.whitelist()` with input verification, comprehensive error handling, and structured JSON responses:

### 1. Get All Available Food Items
* **Endpoint**: `/api/method/restaurant_management.api.get_available_food_items`
* **Method**: `GET`
* **Description**: Returns all food items configured in the system.
* **Sample Response**:
  ```json
  {
    "message": {
      "success": true,
      "message": "Available food items retrieved successfully",
      "count": 8,
      "data": [
        {
          "name": "FI-00007",
          "item_name": "Chicken Biriyani",
          "category": "FC-00002",
          "price": 150.0,
          "tax_percentage": 5.0
        },
        {
          "name": "FI-00001",
          "item_name": "Chicken Burger",
          "category": "FC-00001",
          "price": 150.0,
          "tax_percentage": 5.0
        }
      ]
    }
  }
  ```

### 2. Get Food Item Details by Item Code
* **Endpoint**: `/api/method/restaurant_management.api.get_food_item_details`
* **Method**: `GET`
* **Parameters**: `item_code` (e.g., `FI-00013`)
* **Sample Response**:
  ```json
  {
    "message": {
      "success": true,
      "message": "Food item details retrieved successfully",
      "data": {
        "item_code": "FI-00013",
        "item_name": "Chicken Rolls",
        "category": "FC-00004",
        "price": 30.0,
        "tax_percentage": 2.0,
        "availability": 1
      }
    }
  }
  ```

### 3. Get Restaurant Order Details
* **Endpoint**: `/api/method/restaurant_management.api.get_restaurant_order_details`
* **Method**: `GET`
* **Parameters**: `order_id` (e.g., `ORD-00010`)
* **Sample Response**:
  ```json
  {
    "message": {
      "success": true,
      "message": "Restaurant order details retrieved successfully",
      "data": {
        "name": "ORD-00010",
        "customer_name": "Adith",
        "order_type": "Delivery",
        "order_date": "2026-11-06",
        "order_status": "Cancelled",
        "subtotal": 2540.0,
        "discount": 5.8,
        "tax_amount": 95.8,
        "grand_total": 2630.0,
        "status": "Draft",
        "items": [
          {
            "name": "OI-00019",
            "food_item": "FI-00007",
            "quantity": 10,
            "rate": 150.0,
            "tax_percentage": 5.0,
            "amount": 1500.0
          }
        ]
      }
    }
  }
  ```

### 4. Get Total Sales for Specified Date
* **Endpoint**: `/api/method/restaurant_management.api.get_total_sales`
* **Method**: `GET`
* **Parameters**: `order_date` (format: `YYYY-MM-DD`, e.g., `2026-11-06`)
* **Sample Response**:
  ```json
  {
    "message": {
      "success": true,
      "message": "Total sales retrieved successfully",
      "date": "2026-11-06",
      "completed_orders": 4,
      "total_sales": 2494.4,
      "currency": "INR"
    }
  }
  ```

---

## 📊 Part E – Analytics & Daily Sales Report

A dedicated **Daily Restaurant Sales Report** was built to provide daily revenue tracking:
* **Report Columns**:
  1. `Order ID`
  2. `Customer Name`
  3. `Order Date`
  4. `Subtotal`
  5. `Tax Amount`
  6. `Discount`
  7. `Grand Total`
  8. `Order Status`
* **Filters**: Includes an active `Order Date` filter allowing staff and management to inspect sales and completed order tallies for any selected date.

---

## 🔐 Part F – Roles, Permissions & Order Workflow

### Roles Configured
1. **Restaurant Manager**:
   * Complete operational and management access across all DocTypes.
   * Can create, read, update, submit, and cancel orders.
   * Exclusive privilege to cancel confirmed orders and modify completed orders.
2. **Waiter**:
   * Order taking role.
   * Allowed to create new orders and view permitted records.
   * Restricted from unauthorized order cancellations and master record deletions.

### Order Workflow Lifecycle
```
[Draft] ----------> [Confirmed] ----------> [Completed]
   |                     |
   |                     | (Manager Only)
   v                     v
[Cancelled] <------------+
```

* **Draft &rarr; Confirmed**: Waiter or Manager confirms order upon customer acceptance.
* **Confirmed &rarr; Completed**: Final settlement upon payment and food delivery.
* **Confirmed &rarr; Cancelled**: Allowed strictly for users holding the `Restaurant Manager` role.

---

## 📸 Validation Proofs & Screenshots

All validation proofs and testing results are organized below and stored directly in the `screenshots/` directory:

### Part A: DocTypes & Orders Overview

#### 1. Required DocTypes Created
Visual proof showing all 4 custom DocTypes (`Food Category`, `Restaurant Order`, `Order Item`, `Food Item`) created under the **Restaurant Management** module.
![Required DocTypes](screenshots/validation_req_doctypes.png)

#### 2. Restaurant Order List View
List view demonstrating multiple active, submitted, and cancelled orders with customer names, order dates, and order types (`Dine-in`, `Delivery`, `Takeaway`).
![Restaurant Orders List View](screenshots/validation_rest_ordered_items.png)

---

### Part B & C: Client Scripts & Server Validations

#### 3. Real-Time Auto-Calculations
Dynamic client-side auto-computation of row Amount (`Quantity × Rate`), Subtotal, itemized Tax Amount, and Grand Total.
![Automated Calculations](screenshots/validation_auto_calculations.png)

#### 4. Validation: Empty / Missing Food Item
Validation error preventing order creation when a food item row is empty or not selected.
![Empty Item Validation](screenshots/validation_no_food.png)

#### 5. Validation: Zero or Negative Quantity
Validation alert preventing zero or negative values in the quantity field (`Quantity must be greater than zero.`).
![Quantity Validation](screenshots/validation_neg_food.png)

#### 6. Validation: Discount Exceeding Subtotal
Validation message preventing users from entering a discount amount greater than the order subtotal.
![Discount Validation](screenshots/validation_discount_higher.png)

#### 7. Custom Feature: 'Generate Bill' Modal Dialog
Interactive bill modal displaying order metadata, item breakdown table, subtotal, tax amount, discount, and grand total.
![Generate Bill Dialog](screenshots/validation_completed_order.png)

---

### Part D: REST API Testing in Postman

#### 8. API 1: Get All Available Food Items
Testing `GET /api/method/restaurant_management.api.get_available_food_items` returning HTTP 200 OK and list of available items.
![API 1 - Available Food Items](screenshots/API1.png)

#### 9. API 2: Get Food Item Details by Item Code
Testing `GET /api/method/restaurant_management.api.get_food_item_details?item_code=FI-00013` returning HTTP 200 OK and item details.
![API 2 - Food Item Details](screenshots/API2.png)

#### 10. API 3: Get Restaurant Order Details
Testing `GET /api/method/restaurant_management.api.get_restaurant_order_details?order_id=ORD-00010` returning HTTP 200 OK and order data.
![API 3 - Restaurant Order Details](screenshots/API3.png)

#### 11. API 4: Get Total Sales for Specified Date
Testing `GET /api/method/restaurant_management.api.get_total_sales?order_date=2026-11-06` returning HTTP 200 OK, completed order count, and total sales.
![API 4 - Daily Total Sales](screenshots/API4.png)

---

### Part E & F: Report & Workflow

#### 12. Daily Restaurant Sales Report
Report view showing date-filtered (`05-11-2026`) daily order sales, taxes, discounts, grand totals, and order statuses.
![Daily Sales Report](screenshots/validation_auto_bill.png)

#### 13. Restaurant Order Workflow
Workflow graph configuration showing states (`Draft` &rarr; `Confirmed` &rarr; `Completed` / `Cancelled`) with role-based cancellation permissions.
![Restaurant Order Workflow](screenshots/validation_workflow.png)

---

## 🚀 Installation & Setup

1. **Install App to Bench**:
   ```bash
   cd /path/to/your/frappe-bench
   bench get-app restaurant_management
   bench --site <your-site-name> install-app restaurant_management
   ```

2. **Run Migrations**:
   ```bash
   bench --site <your-site-name> migrate
   ```

3. **Restart Bench**:
   ```bash
   bench restart
   ```

---

## 📄 License
This project is licensed under the [MIT License](license.txt).
