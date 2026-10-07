variable "project_id" {
  description = "Existing Atlas project ID"
  type        = string
}

variable "cluster_name" {
  description = "Atlas cluster name"
  type        = string
  default     = "leafy"
}

variable "region" {
  description = "AWS Region (defaults to London)"
  type        = string
  default     = "EU_WEST_2"
}

variable "instance_size" {
  type    = string
  default = "M10"
}

variable "node_count" {
  type    = number
  default = 3
}

variable "cluster_tags" {
  description = "Tags applied to the Atlas cluster"
  type        = map(string)
  default = {
    environment  = "demo"
    project      = "leafy"
    owner        = "animesh.mishra@mongodb.com"
    "managed-by" = "Terraform"
  }
}

variable "db_username" {
  type    = string
  default = "leafy_app"
}

variable "allowed_cidr" {
  description = "CIDR allowed to connect"
  type        = string
  default     = "104.30.164.2/32"
}
