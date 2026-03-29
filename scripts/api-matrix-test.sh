#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:3002"

print() { echo "[TEST] $*"; }

# 1) Registrar y login
print "Register user"
curl -s -X POST "$BASE_URL/api/auth/register" -H 'Content-Type: application/json' -d '{"email":"matrix@example.com","password":"password","name":"Matrix Test"}' || true
print "Login user"
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"matrix@example.com","password":"password"}' | python3 -c 'import json,sys; r=json.load(sys.stdin); print(r.get("token",""))')
if [[ -z "$TOKEN" ]]; then
echo "ERROR: token vacío"
exit 1
fi

# valor desechable para no colisionar en pruebas repetidas
RUN_ID=$(date +%s%N)

# helper curl
c() { curl -s -w "\n%{http_code}" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' "$@"; }

# 2) Client create
CLIENT_EMAIL="client-matrix-$RUN_ID@example.com"
print "Create client ($CLIENT_EMAIL)"
RESP=$(c -X POST "$BASE_URL/api/clients" -d '{"name":"Client Matrix","email":"'$CLIENT_EMAIL'"}')
CLIENT_STATUS=$(printf '%s' "$RESP" | tail -n1)
CLIENT_RESPONSE=$(printf '%s' "$RESP" | sed '$d')
print "Client status $CLIENT_STATUS"
if [[ "$CLIENT_STATUS" != "201" ]]; then echo "CLIENT create failed: $CLIENT_RESPONSE"; exit 1; fi
CLIENT_ID=$(echo "$CLIENT_RESPONSE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')

# 3) Client update
print "Update client"
RESP=$(c -X PUT "$BASE_URL/api/clients/$CLIENT_ID" -d '{"name":"Client Matrix Updated","email":"'$CLIENT_EMAIL'"}')
CLIENT_STATUS=$(printf '%s' "$RESP" | tail -n1)
CLIENT_RESPONSE=$(printf '%s' "$RESP" | sed '$d')
if [[ "$CLIENT_STATUS" != "200" ]]; then echo "CLIENT update failed: $CLIENT_RESPONSE"; exit 1; fi

# 4) Project create
print "Create project"
RESP=$(c -X POST "$BASE_URL/api/projects" -d '{"name":"Project Matrix","description":"Prueba","status":"ACTIVE","clientId":"'$CLIENT_ID'"}')
PROJECT_STATUS=$(printf '%s' "$RESP" | tail -n1)
PROJECT_RESPONSE=$(printf '%s' "$RESP" | sed '$d')
if [[ "$PROJECT_STATUS" != "201" ]]; then echo "PROJECT create failed: $PROJECT_RESPONSE"; exit 1; fi
PROJECT_ID=$(echo "$PROJECT_RESPONSE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')

# 5) Project update
print "Update project"
RESP=$(c -X PUT "$BASE_URL/api/projects/$PROJECT_ID" -d '{"name":"Project Matrix Updated","description":"Prueba 2","status":"PLANNING","clientId":"'$CLIENT_ID'"}')
PROJECT_STATUS=$(printf '%s' "$RESP" | tail -n1)
PROJECT_RESPONSE=$(printf '%s' "$RESP" | sed '$d')
if [[ "$PROJECT_STATUS" != "200" ]]; then echo "PROJECT update failed: $PROJECT_RESPONSE"; exit 1; fi

# 6) Invoice create
print "Create invoice"
RESP=$(c -X POST "$BASE_URL/api/invoices" -d '{"invoiceNumber":"INV-MATRIX-1","issueDate":"2026-03-23","dueDate":"2026-04-23","status":"PENDING","subtotal":100,"taxRate":10,"totalAmount":110,"clientId":"'$CLIENT_ID'","projectId":"'$PROJECT_ID'","items":[{"description":"Item1","quantity":1,"unitPrice":100}]}')
INVOICE_STATUS=$(printf '%s' "$RESP" | tail -n1)
INVOICE_RESPONSE=$(printf '%s' "$RESP" | sed '$d')
if [[ "$INVOICE_STATUS" != "201" ]]; then echo "INVOICE create failed: $INVOICE_RESPONSE"; exit 1; fi
INVOICE_ID=$(echo "$INVOICE_RESPONSE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')

# 7) Invoice update
print "Update invoice"
RESP=$(c -X PUT "$BASE_URL/api/invoices/$INVOICE_ID" -d '{"invoiceNumber":"INV-MATRIX-1","issueDate":"2026-03-23","dueDate":"2026-04-23","status":"PAID","subtotal":200,"taxRate":10,"totalAmount":220,"clientId":"'$CLIENT_ID'","projectId":"'$PROJECT_ID'","items":[{"description":"Item1","quantity":2,"unitPrice":100}]}')
INVOICE_STATUS=$(printf '%s' "$RESP" | tail -n1)
INVOICE_RESPONSE=$(printf '%s' "$RESP" | sed '$d')
if [[ "$INVOICE_STATUS" != "200" ]]; then echo "INVOICE update failed: $INVOICE_RESPONSE"; exit 1; fi

# 8) List results
print "List clients"
c -X GET "$BASE_URL/api/clients"
print "List projects"
c -X GET "$BASE_URL/api/projects"
print "List invoices"
c -X GET "$BASE_URL/api/invoices"

# 9) Delete invoice/project/client
print "Delete invoice"
RESP=$(c -X DELETE "$BASE_URL/api/invoices/$INVOICE_ID")
INVOICE_STATUS=$(printf '%s' "$RESP" | tail -n1)
if [[ "$INVOICE_STATUS" != "204" ]]; then echo "INVOICE delete failed (status=$INVOICE_STATUS): $RESP"; exit 1; fi
print "Delete project"
RESP=$(c -X DELETE "$BASE_URL/api/projects/$PROJECT_ID")
PROJECT_STATUS=$(printf '%s' "$RESP" | tail -n1)
if [[ "$PROJECT_STATUS" != "204" ]]; then echo "PROJECT delete failed (status=$PROJECT_STATUS): $RESP"; exit 1; fi
print "Delete client"
RESP=$(c -X DELETE "$BASE_URL/api/clients/$CLIENT_ID")
CLIENT_STATUS=$(printf '%s' "$RESP" | tail -n1)
if [[ "$CLIENT_STATUS" != "200" ]]; then echo "CLIENT delete failed (status=$CLIENT_STATUS): $RESP"; exit 1; fi

print "ALL TESTS PASSED"