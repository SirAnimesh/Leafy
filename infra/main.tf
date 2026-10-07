resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "-_" // Characters like @?:# will break URI parsing unless percent-encoded, no drama
}

resource "mongodbatlas_advanced_cluster" "this" {
  project_id             = var.project_id
  name                   = var.cluster_name
  cluster_type           = "REPLICASET"
  version_release_system = "CONTINUOUS"

  replication_specs = [
    {
      region_configs = [
        {
          provider_name = "AWS"
          region_name   = var.region
          priority      = 7
          electable_specs = {
            instance_size = var.instance_size
            node_count    = var.node_count
          }
        }
      ]
    }
  ]

  tags = var.cluster_tags
}

resource "mongodbatlas_database_user" "app" {
  project_id         = var.project_id
  username           = var.db_username
  password           = random_password.db.result
  auth_database_name = "admin"

  roles {
    role_name     = "readWrite"
    database_name = "leafy"
  }

  roles {
    role_name     = "readWrite"
    database_name = "sample_mflix"
  }
}

resource "mongodbatlas_project_ip_access_list" "me" {
  project_id = var.project_id
  cidr_block = var.allowed_cidr
  comment    = "Local dev access"
}
