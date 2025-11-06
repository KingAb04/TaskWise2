"""
Script to drop and recreate the subtasks table correctly
"""
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def fix_subtasks_table():
    try:
        # Connect to MySQL
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST', '127.0.0.1'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'taskwise_db')
        )
        
        cursor = connection.cursor()
        
        # Drop the existing table
        print("Dropping existing subtasks table...")
        cursor.execute("DROP TABLE IF EXISTS subtasks")
        connection.commit()
        
        # Create subtasks table with correct schema
        print("Creating new subtasks table...")
        create_table_query = """
        CREATE TABLE subtasks (
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
        
        print("✅ Subtasks table fixed successfully!")
        
        cursor.close()
        connection.close()
        
    except mysql.connector.Error as error:
        print(f"❌ Error fixing subtasks table: {error}")
        raise

if __name__ == "__main__":
    print("Fixing subtasks table...")
    fix_subtasks_table()
