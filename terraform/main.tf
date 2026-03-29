terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "docker" {
  registry_auth {
    address  = "${var.region}-docker.pkg.dev"
    username = "oauth2accesstoken"
    password = data.google_client_config.default.access_token
  }
}

data "google_client_config" "default" {}

# Enable APIs

resource "google_project_service" "cloudrun" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "artifactregistry" {
  service            = "artifactregistry.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "sqladmin" {
  service            = "sqladmin.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "storage" {
  service            = "storage.googleapis.com"
  disable_on_destroy = false
}

# Artifact Registry

resource "google_artifact_registry_repository" "vigil" {
  location      = var.region
  repository_id = "vigil"
  format        = "DOCKER"
  description   = "Docker images for Vigil"

  depends_on = [google_project_service.artifactregistry]
}

# Docker image

resource "docker_image" "backend" {
  name = "${var.region}-docker.pkg.dev/${var.project_id}/vigil/backend:${var.image_tag}"

  build {
    context    = "${path.module}/../backend"
    dockerfile = "Dockerfile"
    target     = "prod"
    platform   = "linux/amd64"
    no_cache   = true
  }

  depends_on = [google_artifact_registry_repository.vigil]
}

resource "docker_registry_image" "backend" {
  name = docker_image.backend.name

  depends_on = [docker_image.backend]
}

# Cloud SQL (PostgreSQL)

resource "google_sql_database_instance" "vigil" {
  name             = "vigil-postgres"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier              = "db-f1-micro"
    availability_type = "ZONAL"
    disk_size         = 10
    disk_autoresize   = false

    backup_configuration {
      enabled = false
    }

    ip_configuration {
      ipv4_enabled = true

      authorized_networks {
        name  = "allow-all-temporary"
        value = "0.0.0.0/0"
      }
    }
  }

  deletion_protection = false

  depends_on = [google_project_service.sqladmin]
}

resource "google_sql_database" "vigil" {
  name     = "vigil"
  instance = google_sql_database_instance.vigil.name
}

resource "google_sql_user" "vigil" {
  name     = var.db_user
  instance = google_sql_database_instance.vigil.name
  password = var.db_password
}

# GCS Bucket (hero portraits)

resource "google_storage_bucket" "portraits" {
  name          = "${var.project_id}-vigil-portraits"
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.storage]
}

resource "google_storage_bucket_iam_member" "portraits_public" {
  bucket = google_storage_bucket.portraits.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# Cloud Run — Backend

resource "google_cloud_run_service" "backend" {
  name     = "vigil-backend"
  location = var.region

  template {
    spec {
      containers {
        image = "${var.region}-docker.pkg.dev/${var.project_id}/vigil/backend@${docker_registry_image.backend.sha256_digest}"

        resources {
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }

        env {
          name  = "DB_URL"
          value = "postgresql://${var.db_user}:${var.db_password}@${google_sql_database_instance.vigil.public_ip_address}:5432/vigil?sslmode=disable"
        }

        env {
          name  = "OPENAI_API_KEY"
          value = var.openai_api_key
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = "0"
        "autoscaling.knative.dev/maxScale" = "1"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_service.cloudrun,
    docker_registry_image.backend,
    google_sql_database_instance.vigil,
  ]
}

resource "google_cloud_run_service_iam_member" "backend_public" {
  service  = google_cloud_run_service.backend.name
  location = google_cloud_run_service.backend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
