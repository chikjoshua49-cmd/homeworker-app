-- Create extension for UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  profile_picture_url VARCHAR(255),
  bio TEXT,
  role VARCHAR(50) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'worker', 'admin')),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Service categories table
CREATE TABLE service_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Worker profiles table
CREATE TABLE worker_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  hourly_rate DECIMAL(10, 2) NOT NULL,
  bio TEXT,
  years_of_experience INTEGER,
  is_verified BOOLEAN DEFAULT false,
  rating DECIMAL(3, 2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_completed_jobs INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_worker_profiles_user_id ON worker_profiles(user_id);
CREATE INDEX idx_worker_profiles_rating ON worker_profiles(rating DESC);

-- Worker services (many-to-many: workers can offer multiple services)
CREATE TABLE worker_services (
  id SERIAL PRIMARY KEY,
  worker_id INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  service_category_id INTEGER NOT NULL REFERENCES service_categories(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_worker_services_worker_id ON worker_services(worker_id);
CREATE INDEX idx_worker_services_service_id ON worker_services(service_category_id);

-- Customer profiles table
CREATE TABLE customer_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  rating DECIMAL(3, 2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_profiles_user_id ON customer_profiles(user_id);

-- Jobs table
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_category_id INTEGER NOT NULL REFERENCES service_categories(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'cancelled')),
  budget DECIMAL(10, 2) NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration_hours INTEGER NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_service_id ON jobs(service_category_id);
CREATE INDEX idx_jobs_scheduled_date ON jobs(scheduled_date);

-- Job applications table (workers applying for jobs)
CREATE TABLE job_applications (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP,
  UNIQUE(job_id, worker_id)
);

CREATE INDEX idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX idx_job_applications_worker_id ON job_applications(worker_id);
CREATE INDEX idx_job_applications_status ON job_applications(status);

-- Bookings table (core transaction record)
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_category_id INTEGER NOT NULL REFERENCES service_categories(id),
  status VARCHAR(50) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'in_progress', 'awaiting_customer_confirmation', 'completed', 'cancelled', 'disputed')),
  total_amount DECIMAL(10, 2) NOT NULL,
  commission_amount DECIMAL(10, 2),
  worker_amount DECIMAL(10, 2),
  checked_in_at TIMESTAMP,
  checked_out_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_worker_id ON bookings(worker_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);

-- Wallet/Payment accounts table
CREATE TABLE wallets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  hold_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  available_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- Transactions table
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('booking_hold', 'release_to_worker', 'commission_charge', 'refund')),
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_booking_id ON transactions(booking_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Reviews table
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX idx_reviews_booking_id ON reviews(booking_id);

-- Disputes table
CREATE TABLE disputes (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  opened_by_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
  resolution TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX idx_disputes_booking_id ON disputes(booking_id);
CREATE INDEX idx_disputes_status ON disputes(status);

-- Notifications table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
