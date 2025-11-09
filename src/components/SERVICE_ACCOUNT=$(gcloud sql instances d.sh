SERVICE_ACCOUNT=$(gcloud sql instances describe lifecycle-db --format="p122356767765-qh1s4g@gcp-sa-cloud-sql.iam.gserviceaccount.com"

SERVICE_ACCOUNT=$(gcloud sql instances describe lifecycle-db --format="value(servp122356767765-qh1s4g@gcp-sa-cloud-sql.iam.gserviceaccount.com)")