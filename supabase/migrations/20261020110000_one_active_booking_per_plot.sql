-- Two people could book the same plot: createBooking only checked the status it read, and
-- nothing in the database stopped a second pending/confirmed booking on the same plot.
create unique index if not exists bookings_one_active_per_plot
  on public.bookings (plot_id)
  where status <> 'cancelled';
