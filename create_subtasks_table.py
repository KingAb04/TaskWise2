"""
Migration script to create the subtasks table
"""
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def create_subtasks_table():
    try:
        # Connect to MySQL
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST', '127.0.0.1'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'taskwise_db')
        )
        
        cursor = connection.cursor()
        
        # Create subtasks table
        create_table_query = """
        CREATE TABLE IF NOT EXISTS subtasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            `order` INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            INDEX idx_task_id (task_id),
            INDEX idx_order (`order`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """
        
        cursor.execute(create_table_query)
        connection.commit()
        
        print("✅ Subtasks table created successfully!")
        
        cursor.close()
        connection.close()
        
    except mysql.connector.Error as error:
        print(f"❌ Error creating subtasks table: {error}")
        raise

if __name__ == "__main__":
    print("Creating subtasks table...")
    create_subtasks_table()
