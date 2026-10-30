-- حذف فهارس مكررة + فهارس للمفاتيح الأجنبية (تطبق عبر MCP)
drop index if exists public.idx_auction_listings_brand;
drop index if exists public.idx_orders_branch;
drop index if exists public.idx_orders_created;
drop index if exists public.idx_orders_phone;
create index if not exists idx_loyalty_cards_customer on public.loyalty_cards(customer_id);
create index if not exists idx_loyalty_stamps_card on public.loyalty_stamps(card_id);
create index if not exists idx_loyalty_notifications_card on public.loyalty_notifications(card_id);
create index if not exists idx_orders_employee on public.orders(employee_id);
create index if not exists idx_sales_invoices_employee on public.sales_invoices(employee_id);
create index if not exists idx_sales_invoices_branch on public.sales_invoices(branch_id);
create index if not exists idx_stock_movements_item on public.stock_movements(item_id);
create index if not exists idx_stock_movements_branch on public.stock_movements(branch_id);
create index if not exists idx_bookings_branch on public.bookings(branch_id);
create index if not exists idx_expenses_branch on public.expenses(branch_id);
create index if not exists idx_partner_prices_service on public.partner_prices(service_id);
