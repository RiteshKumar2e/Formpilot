"""The profile fields FormPilot understands, and the many ways forms ask for them."""

FIELD_LABELS: dict[str, str] = {
    "full_name": "Full name",
    "email": "Email",
    "phone": "Phone",
    "date_of_birth": "Date of birth",
    "highest_qualification": "Highest qualification",
    "institution": "Institution",
    "graduation_year": "Graduation year",
    "experience": "Professional experience",
    "skills": "Skills",
    "linkedin": "LinkedIn",
    "github": "GitHub",
}

# Fields used to compute profile completeness.
CORE_FIELDS = ("full_name", "email", "phone", "date_of_birth", "highest_qualification", "institution", "experience", "skills")

# Fields where several values are merged instead of treated as a conflict.
MULTI_VALUE_FIELDS = {"skills"}

# Phrasings that application forms commonly use for each field.
CONCEPTS: dict[str, list[str]] = {
    "full_name": [
        "full name", "name", "your name", "name of applicant", "applicant name", "candidate name",
        "legal name", "full legal name", "name as on id", "student name", "name of candidate",
    ],
    "email": ["email", "email address", "e-mail", "contact email", "email id", "mail id", "personal email"],
    "phone": [
        "phone", "phone number", "mobile", "mobile number", "contact number", "telephone",
        "cell phone", "whatsapp number", "mobile no",
    ],
    "date_of_birth": ["date of birth", "dob", "birth date", "birthday", "born on"],
    "highest_qualification": [
        "highest qualification", "education", "qualification", "degree", "latest degree",
        "latest degree earned", "education level", "highest degree", "educational qualification",
        "academic qualification", "highest level of education",
    ],
    "institution": [
        "institution", "university", "college", "school", "name of institution", "university name",
        "college name", "alma mater", "institute",
    ],
    "graduation_year": ["graduation year", "year of graduation", "year of passing", "passing year", "batch", "class of"],
    "experience": [
        "professional experience", "work experience", "experience", "current role", "employment history",
        "most recent position", "current position", "job title", "previous employment", "work history",
    ],
    "skills": ["skills", "technical skills", "key skills", "core competencies", "areas of expertise", "technologies"],
    # Details FormPilot doesn't extract yet. Recognizing them stops look-alike labels
    # ("Current Address" vs "Email Address") from being matched to the wrong field.
    "address": ["address", "current address", "residential address", "permanent address", "mailing address", "home address", "city"],
    "emergency_contact": ["emergency contact", "emergency contact number", "guardian contact", "next of kin"],
    "linkedin": ["linkedin", "linkedin profile", "linkedin url"],
    "github": ["github", "github profile", "github url", "code repository", "portfolio code"],
}
