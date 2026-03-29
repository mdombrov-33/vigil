output "backend_url" {
  value       = google_cloud_run_service.backend.status[0].url
  description = "Backend API URL"
}

output "db_ip" {
  value       = google_sql_database_instance.vigil.public_ip_address
  description = "Cloud SQL public IP"
}

output "portraits_bucket" {
  value       = google_storage_bucket.portraits.name
  description = "GCS bucket for hero portraits"
}
