variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "europe-central2"
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
}

variable "db_user" {
  description = "PostgreSQL username"
  type        = string
  default     = "vigil"
}

variable "db_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}
