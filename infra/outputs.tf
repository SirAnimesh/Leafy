output "cluster_name" {
  value = mongodbatlas_advanced_cluster.this.name
}

output "connection_string" {
  value = mongodbatlas_advanced_cluster.this.connection_strings.standard_srv
  sensitive = true
}

output "db_username" {
  value = mongodbatlas_database_user.app.username
}

output "db_password" {
  value = random_password.db.result
  sensitive = true
}
